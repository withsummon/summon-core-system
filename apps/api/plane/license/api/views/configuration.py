# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
from smtplib import (
    SMTPAuthenticationError,
    SMTPConnectError,
    SMTPRecipientsRefused,
    SMTPSenderRefused,
    SMTPServerDisconnected,
)
from urllib.parse import urlsplit

# Django imports
from django.core.mail import BadHeaderError, EmailMultiAlternatives, get_connection
from django.db.models import Q, Case, When, Value

# Third party imports
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

# Module imports
from .base import BaseAPIView
from plane.app.services.llm import LLMError, LLMRequest, generate
from plane.license.api.permissions import InstanceAdminPermission
from plane.license.models import InstanceConfiguration
from plane.license.api.serializers import InstanceConfigurationSerializer
from plane.license.utils.encryption import encrypt_data
from plane.utils.cache import cache_response, invalidate_cache
from plane.license.utils.instance_value import get_email_configuration


LLM_PROVIDERS = {"openai", "openai_compatible", "anthropic", "codex", "gemini"}


def validate_llm_configuration(data, current_provider=None):
    values = {}
    errors = {}

    for key in ("LLM_API_KEY", "LLM_PROVIDER", "LLM_MODEL", "LLM_BASE_URL"):
        if key not in data:
            continue
        value = data[key]
        if not isinstance(value, str):
            errors[key] = "Must be a string."
            continue
        values[key] = value.strip()

    provider = values.get("LLM_PROVIDER")
    if provider is not None:
        provider = provider.lower()
        values["LLM_PROVIDER"] = provider
        if provider not in LLM_PROVIDERS:
            errors["LLM_PROVIDER"] = "Select a supported provider."

    if "LLM_MODEL" in values and not values["LLM_MODEL"]:
        errors["LLM_MODEL"] = "Model is required."

    base_url = values.get("LLM_BASE_URL")
    if base_url:
        try:
            parsed_url = urlsplit(base_url)
            valid_url = (
                parsed_url.scheme in {"http", "https"}
                and bool(parsed_url.hostname)
                and parsed_url.username is None
                and parsed_url.password is None
            )
        except ValueError:
            valid_url = False
        if not valid_url:
            errors["LLM_BASE_URL"] = "Use an http or https URL without embedded credentials."
        elif (provider or str(current_provider or "").strip().lower()) != "openai_compatible":
            errors["LLM_BASE_URL"] = "Custom base URL is only supported for OpenAI-compatible providers."

    if "LLM_REQUEST_TIMEOUT_SECONDS" in data:
        try:
            timeout = int(data["LLM_REQUEST_TIMEOUT_SECONDS"])
        except (TypeError, ValueError):
            timeout = None
        if timeout is None or not 5 <= timeout <= 120:
            errors["LLM_REQUEST_TIMEOUT_SECONDS"] = "Use a whole number from 5 through 120."
        else:
            values["LLM_REQUEST_TIMEOUT_SECONDS"] = str(timeout)

    if errors:
        raise ValidationError(errors)
    return values


class InstanceConfigurationEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    @cache_response(60 * 60 * 2, user=False)
    def get(self, request):
        instance_configurations = InstanceConfiguration.objects.all()
        serializer = InstanceConfigurationSerializer(instance_configurations, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @invalidate_cache(path="/api/instances/configurations/", user=False)
    @invalidate_cache(path="/api/instances/", user=False)
    def patch(self, request):
        current_provider = (
            InstanceConfiguration.objects.filter(key="LLM_PROVIDER").values_list("value", flat=True).first()
        )
        validated_values = validate_llm_configuration(request.data, current_provider)
        configuration_keys = set(request.data.keys())
        if validated_values.get("LLM_PROVIDER") not in {None, "openai_compatible"}:
            validated_values["LLM_BASE_URL"] = ""
            configuration_keys.add("LLM_BASE_URL")
        configurations = InstanceConfiguration.objects.filter(key__in=configuration_keys)

        bulk_configurations = []
        for configuration in configurations:
            raw_value = validated_values.get(
                configuration.key,
                request.data.get(configuration.key, configuration.value),
            )
            value = "" if raw_value is None else str(raw_value).strip()
            if configuration.is_encrypted:
                configuration.value = encrypt_data(value)
            else:
                configuration.value = value
            bulk_configurations.append(configuration)

        InstanceConfiguration.objects.bulk_update(bulk_configurations, ["value"], batch_size=100)

        serializer = InstanceConfigurationSerializer(configurations, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class LLMConnectionTestEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    def post(self, request):
        try:
            response = generate(
                LLMRequest(
                    system="Return a concise health response.",
                    messages=[{"role": "user", "content": "health-check"}],
                    temperature=0,
                )
            )
        except LLMError as error:
            return Response({"status": "error", "code": error.code}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"status": "ok", "provider": response.provider, "model": response.model})


class DisableEmailFeatureEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    @invalidate_cache(path="/api/instances/", user=False)
    def delete(self, request):
        try:
            InstanceConfiguration.objects.filter(
                Q(
                    key__in=[
                        "EMAIL_HOST",
                        "EMAIL_HOST_USER",
                        "EMAIL_HOST_PASSWORD",
                        "ENABLE_SMTP",
                        "EMAIL_PORT",
                        "EMAIL_FROM",
                    ]
                )
            ).update(value=Case(When(key="ENABLE_SMTP", then=Value("0")), default=Value("")))
            return Response(status=status.HTTP_200_OK)
        except Exception:
            return Response(
                {"error": "Failed to disable email configuration"},
                status=status.HTTP_400_BAD_REQUEST,
            )


class EmailCredentialCheckEndpoint(BaseAPIView):
    def post(self, request):
        receiver_email = request.data.get("receiver_email", False)
        if not receiver_email:
            return Response(
                {"error": "Receiver email is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        (
            EMAIL_HOST,
            EMAIL_HOST_USER,
            EMAIL_HOST_PASSWORD,
            EMAIL_PORT,
            EMAIL_USE_TLS,
            EMAIL_USE_SSL,
            EMAIL_FROM,
        ) = get_email_configuration()

        # Configure all the connections
        connection = get_connection(
            host=EMAIL_HOST,
            port=int(EMAIL_PORT),
            username=EMAIL_HOST_USER,
            password=EMAIL_HOST_PASSWORD,
            use_tls=EMAIL_USE_TLS == "1",
            use_ssl=EMAIL_USE_SSL == "1",
        )
        # Prepare email details
        subject = "Email Notification from Plane"
        message = "This is a sample email notification sent from Plane application."
        # Send the email
        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=message,
                from_email=EMAIL_FROM,
                to=[receiver_email],
                connection=connection,
            )
            msg.send(fail_silently=False)
            return Response({"message": "Email successfully sent."}, status=status.HTTP_200_OK)
        except BadHeaderError:
            return Response({"error": "Invalid email header."}, status=status.HTTP_400_BAD_REQUEST)
        except SMTPAuthenticationError:
            return Response(
                {"error": "Invalid credentials provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except SMTPConnectError:
            return Response(
                {"error": "Could not connect with the SMTP server."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except SMTPSenderRefused:
            return Response(
                {"error": "From address is invalid."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except SMTPServerDisconnected:
            return Response(
                {"error": "SMTP server disconnected unexpectedly."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except SMTPRecipientsRefused:
            return Response(
                {"error": "All recipient addresses were refused."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except TimeoutError:
            return Response(
                {"error": "Timeout error while trying to connect to the SMTP server."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except ConnectionError:
            return Response(
                {"error": "Network connection error. Please check your internet connection."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            return Response(
                {"error": "Could not send email. Please check your configuration"},
                status=status.HTTP_400_BAD_REQUEST,
            )
