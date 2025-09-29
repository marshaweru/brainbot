# ---- build stage ----
FROM node:20-alpine AS build
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages

# only install what's needed to build the bot
RUN pnpm install --frozen-lockfile
# build the bot (bundled via tsup)
RUN pnpm --filter @brainbot/bot build

# ---- runtime stage ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# runtime deps for the bot (externalized libs must be present)
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/bot/dist /app/apps/bot/dist

# tiny health server (optional if you use a Worker on Render)
# if you need a port for a Web Service, uncomment these 3 lines:
# COPY apps/bot/src/health.js /app/apps/bot/health.js
# ENV PORT=3000
# CMD ["sh","-lc","node apps/bot/health.js & node apps/bot/dist/index.js"]

CMD ["node","apps/bot/dist/index.js"]
