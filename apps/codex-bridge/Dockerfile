FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install --yes --no-install-recommends bubblewrap ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install --global @openai/codex@0.148.0 \
  && mkdir -p /home/node/.codex /workspace \
  && chown -R node:node /home/node/.codex /workspace \
  && rm -f /bin/sh /bin/dash

WORKDIR /app
COPY --chown=node:node server.mjs ./server.mjs

ENV CODEX_HOME=/home/node/.codex \
    CODEX_WORKSPACE=/workspace \
    NODE_ENV=production \
    PORT=8090

USER node
EXPOSE 8090
ENTRYPOINT ["node", "/app/server.mjs"]
