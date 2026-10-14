# syntax=docker/dockerfile:1.7
# Build from the repository root: docker build -f apps/ai/Dockerfile .
FROM oven/bun:1.4.2-alpine AS base

# Workspace manifests plus the lockfile: the install layer stays cached until dependencies change.
FROM base AS manifests
WORKDIR /src
COPY . .
RUN mkdir -p /out && cp package.json bun.lock bunfig.toml /out/ \
  && for f in apps/*/package.json packages/*/package.json; do mkdir -p "/out/$(dirname "$f")" && cp "$f" "/out/$f"; done

FROM base AS builder
WORKDIR /app
COPY --from=manifests /out/ .
RUN --mount=type=cache,id=bun-install,target=/root/.bun/install/cache \
  bun install --frozen-lockfile --filter=ai
COPY . .
# One self-contained bundle: the runtime image needs no node_modules.
RUN cd apps/ai && bun run build

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/apps/ai/dist ./dist
ENV NODE_ENV=production PORT=3300
USER bun
EXPOSE 3300
CMD ["bun", "dist/main.js"]
