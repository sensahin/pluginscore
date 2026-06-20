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
COPY services/scanner services/scanner

RUN rm -rf packages/*/dist services/*/dist
RUN npm run build:packages && npm run build -w services/scanner

FROM node:22-bookworm-slim AS runtime

ARG PLUGIN_CHECK_VERSION=2.0.0

WORKDIR /app
ENV NODE_ENV=production
ENV PLUGINSCORE_API_URL=http://api:4010
ENV SCAN_TMP_DIR=/tmp/pluginscore-scans
ENV SCAN_IDLE_SECONDS=60
ENV SCAN_TIMEOUT_SECONDS=120
ENV WP_CLI_ALLOW_ROOT=1
ENV WP_PATH=/opt/wordpress
ENV PLUGIN_CHECK_VERSION=${PLUGIN_CHECK_VERSION}
ENV PLUGIN_CHECK_COMMAND="/usr/local/bin/run-plugin-check {pluginDir} {jsonPath}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    default-mysql-client \
    php-cli \
    php-curl \
    php-mbstring \
    php-mysql \
    php-xml \
    php-zip \
    unzip \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar -o /usr/local/bin/wp \
  && chmod +x /usr/local/bin/wp \
  && mkdir -p "${WP_PATH}"

COPY services/scanner/runtime/ensure-wp-runtime.sh /usr/local/bin/ensure-wp-runtime
COPY services/scanner/runtime/run-plugin-check.sh /usr/local/bin/run-plugin-check
RUN chmod +x /usr/local/bin/ensure-wp-runtime /usr/local/bin/run-plugin-check

COPY package.json package-lock.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/core/package.json packages/core/package.json
COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/packages/scoring/package.json packages/scoring/package.json
COPY --from=build /app/packages/scoring/dist packages/scoring/dist
COPY --from=build /app/packages/wporg/package.json packages/wporg/package.json
COPY --from=build /app/packages/wporg/dist packages/wporg/dist
COPY --from=build /app/services/scanner/package.json services/scanner/package.json
COPY --from=build /app/services/scanner/dist services/scanner/dist

CMD ["node", "services/scanner/dist/index.js", "work"]
