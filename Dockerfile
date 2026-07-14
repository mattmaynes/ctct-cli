# Container image for the ctct CLI, so it can run on a host without a Node
# runtime (e.g. a Docker-only box running `ctct refresh-token` from cron):
#   docker run --rm --env-file .env.site ghcr.io/mattmaynes/ctct-cli refresh-token
#
# glibc base (bookworm-slim), not alpine/musl, so @napi-rs/keyring's prebuilt
# native binary loads without a compiler.

FROM node:22-bookworm-slim AS build
WORKDIR /app
# Install with dev deps to compile TypeScript. --ignore-scripts so the `prepare`
# build hook does not run before the sources are copied.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
# Only the compiled output + production dependencies + package.json (the CLI reads
# its version from it at runtime).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
# Run as the non-root node user that ships with the base image.
USER node
ENTRYPOINT ["node", "dist/cli.js"]
