# syntax=docker/dockerfile:1

# The docs site image. Build from the repository root, since the docs app compiles the
# workspace packages it renders:
#
#   docker build --platform linux/amd64 -f apps/docs/Dockerfile -t fuse-docs .
#
# Pages prerender during `next build`, so the runtime stage only carries Next's standalone
# server, its static assets and the generated public files.

# Keep in step with .node-version.
ARG NODE_VERSION=24.13.0

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    TURBO_TELEMETRY_DISABLED=1
WORKDIR /repo

FROM base AS build
# Install the pnpm release named by `packageManager` rather than trusting whichever
# Corepack happens to ship with this Node.
COPY package.json ./
RUN npm install --global "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")"
# Fetch the store from the lockfile alone, so this layer survives source-only changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch --frozen-lockfile
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --offline
# The public origin the image serves, which absolute og:image URLs need (src/lib/site-origin.ts).
# Pages prerender here, so the build bakes it in; the workflows read it from the Container Apps
# environment before building. Declared after the install layers so a new origin keeps their cache.
ARG DOCS_ORIGIN
ENV DOCS_ORIGIN=${DOCS_ORIGIN}
# The docs build depends on `generate`, which depends on the Fuse build (apps/docs/turbo.json).
RUN pnpm exec turbo run build --filter=docs

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
# The landing renders per request and reads the origin at runtime, so it must match the build's.
ARG DOCS_ORIGIN
ENV DOCS_ORIGIN=${DOCS_ORIGIN} \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
# The standalone tree mirrors the workspace (outputFileTracingRoot), so the server sits at
# apps/docs/server.js. Next leaves static assets and public/ for the host to copy in.
COPY --from=build --chown=node:node /repo/apps/docs/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/docs/.next/static ./apps/docs/.next/static
COPY --from=build --chown=node:node /repo/apps/docs/public ./apps/docs/public
USER node
EXPOSE 3000
WORKDIR /app/apps/docs
CMD ["node", "server.js"]
