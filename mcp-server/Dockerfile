# Build the bundle first from the repo root: pnpm mcp:build
# Then: docker build -t dailytodo-mcp mcp-server
FROM node:22-alpine
WORKDIR /app
COPY dist/server.mjs ./server.mjs
ENV NODE_ENV=production PORT=8787
EXPOSE 8787
USER node
HEALTHCHECK CMD wget -qO- http://127.0.0.1:8787/health || exit 1
CMD ["node", "server.mjs"]
