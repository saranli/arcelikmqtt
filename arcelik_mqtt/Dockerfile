ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest
FROM ${BUILD_FROM}

RUN apk add --no-cache nodejs npm

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY index.js arcelik-api.js ./
COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
