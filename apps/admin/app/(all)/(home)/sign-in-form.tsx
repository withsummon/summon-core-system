import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@plane/propel/button";
import { Input, Spinner } from "@plane/ui";
import { Banner } from "@/components/common/banner";
import { authClient } from "@/providers/instance.provider";
import { FormHeader } from "@/components/instance/form-header";
import { AuthHeader } from "./auth-header";

export function InstanceSignInForm() {
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: searchParams.get("email") ?? "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleFormChange = (key: keyof typeof formData, value: string) =>
    setFormData((previous) => ({ ...previous, [key]: value }));
  async function signIn() {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await authClient.signIn.email(formData);
      if (result.error) setError(result.error.message ?? "Sign in failed.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Sign in failed.");
    } finally {
      setIsSubmitting(false);
    }
  }
  return (
    <>
      <AuthHeader />
      <div className="mt-10 flex w-full flex-grow flex-col items-center justify-center py-6">
        <div className="relative flex w-full max-w-[22.5rem] flex-col gap-6">
          <FormHeader
            heading="Manage your Plane instance"
            subHeading="Configure instance-wide settings to secure your instance"
          />
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void signIn();
            }}
          >
            {error && <Banner type="error" message={error} />}
            <div className="w-full space-y-1">
              <label className="text-13 font-medium text-tertiary" htmlFor="email">
                Email <span className="text-danger-primary">*</span>
              </label>
              <Input
                className="w-full border border-subtle !bg-surface-1 placeholder:text-placeholder"
                id="email"
                name="email"
                type="email"
                inputSize="md"
                placeholder="name@company.com"
                value={formData.email}
                onChange={(e) => handleFormChange("email", e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="w-full space-y-1">
              <label className="text-13 font-medium text-tertiary" htmlFor="password">
                Password <span className="text-danger-primary">*</span>
              </label>
              <div className="relative">
                <Input
                  className="w-full border border-subtle !bg-surface-1 placeholder:text-placeholder"
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  inputSize="md"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => handleFormChange("password", e.target.value)}
                  autoComplete="current-password"
                />
                {showPassword ? (
                  <button
                    type="button"
                    aria-label="Hide password"
                    className="absolute top-3.5 right-3 flex items-center justify-center text-placeholder"
                    onClick={() => setShowPassword(false)}
                  >
                    <EyeOff className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="Show password"
                    className="absolute top-3.5 right-3 flex items-center justify-center text-placeholder"
                    onClick={() => setShowPassword(true)}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="py-2">
              <Button
                type="submit"
                size="xl"
                className="w-full"
                disabled={isSubmitting || !formData.email || !formData.password}
              >
                {isSubmitting ? <Spinner height="20px" width="20px" /> : "Sign in"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
