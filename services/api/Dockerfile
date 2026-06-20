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
COPY services/api services/api

RUN rm -rf packages/*/dist services/*/dist
RUN npm run build:packages && npm run build -w services/api

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV PORT=4010

COPY package.json package-lock.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/core/package.json packages/core/package.json
COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/packages/scoring/package.json packages/scoring/package.json
COPY --from=build /app/packages/scoring/dist packages/scoring/dist
COPY --from=build /app/packages/wporg/package.json packages/wporg/package.json
COPY --from=build /app/packages/wporg/dist packages/wporg/dist
COPY --from=build /app/services/api/package.json services/api/package.json
COPY --from=build /app/services/api/dist services/api/dist
COPY --from=build /app/services/api/db services/api/db

EXPOSE 4010

CMD ["node", "services/api/dist/index.js"]
