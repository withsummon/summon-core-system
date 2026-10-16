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
# The commit this image was built from, read from the clone's .git (Dockerfile.dockerignore lets in HEAD and refs).
RUN --mount=type=bind,source=.git,target=/git \
  head=$(cat /git/HEAD) \
  && case "$head" in \
    "ref: "*) ref=${head#ref: }; { cat "/git/$ref" 2>/dev/null || grep " $ref\$" /git/packed-refs | cut -d" " -f1; } ;; \
    *) echo "$head" ;; \
  esac > VERSION \
  && grep -Eq '^[0-9a-f]{40}$' VERSION
COPY --chmod=755 apps/ai/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
ENV NODE_ENV=production PORT=3300
USER bun
EXPOSE 3300
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
