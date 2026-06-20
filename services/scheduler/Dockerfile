FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/scoring/package.json packages/scoring/package.json
COPY packages/wporg/package.json packages/wporg/package.json
COPY services/api/package.json services/api/package.json
COPY services/scanner/package.json services/scanner/package.json
COPY services/scheduler/package.json services/scheduler/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

COPY packages packages
COPY services/scheduler services/scheduler

RUN rm -rf packages/*/dist services/*/dist
RUN npm run build:packages && npm run build -w services/scheduler

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PLUGINSCORE_API_URL=http://api:4010
ENV SCHEDULER_LIMIT=1000
ENV SCHEDULER_INTERVAL_SECONDS=3600
ENV SCHEDULER_PRIORITY=100

COPY package.json package-lock.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/core/package.json packages/core/package.json
COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/packages/scoring/package.json packages/scoring/package.json
COPY --from=build /app/packages/scoring/dist packages/scoring/dist
COPY --from=build /app/packages/wporg/package.json packages/wporg/package.json
COPY --from=build /app/packages/wporg/dist packages/wporg/dist
COPY --from=build /app/services/scheduler/package.json services/scheduler/package.json
COPY --from=build /app/services/scheduler/dist services/scheduler/dist

CMD ["node", "services/scheduler/dist/index.js", "work"]
