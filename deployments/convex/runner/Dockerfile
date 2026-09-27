FROM node:22.18.0-bookworm-slim
WORKDIR /app
ARG SOURCE_REVISION
RUN test "${#SOURCE_REVISION}" -eq 40 && case "$SOURCE_REVISION" in *[!0-9a-f]*) exit 1 ;; esac
ENV CI=true HUSKY=0
RUN corepack enable
COPY . .
COPY deployments/convex/runner/editor.config.mjs packages/editor/tsdown.runner.config.mjs
RUN corepack pnpm install --frozen-lockfile --prefer-offline \
    && corepack pnpm --filter '@plane/propel...' run build \
    && corepack pnpm --filter @plane/editor exec tsdown --config tsdown.runner.config.mjs \
    && corepack pnpm --filter @summon/convex check:types
LABEL org.opencontainers.image.revision=$SOURCE_REVISION
ENV SOURCE_REVISION=$SOURCE_REVISION
USER node
WORKDIR /app/apps/convex
ENTRYPOINT ["/bin/sh", "/app/deployments/convex/runner/deploy.sh"]
