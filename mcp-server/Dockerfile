# Builds from the repo root (Coolify: base directory "/", Dockerfile
# "/mcp-server/Dockerfile"). Local: docker build -f mcp-server/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
# Scripts skipped: the bundle only needs esbuild and the runtime packages.
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
COPY mcp-server ./mcp-server
RUN pnpm mcp:build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /repo/mcp-server/dist/server.mjs ./server.mjs
ENV NODE_ENV=production PORT=8787
EXPOSE 8787
USER node
HEALTHCHECK CMD wget -qO- http://127.0.0.1:8787/health || exit 1
CMD ["node", "server.mjs"]
