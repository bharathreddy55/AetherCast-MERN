FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
ENV NODE_ENV=production MUSIC_PROCESSING_ENABLED=true FFMPEG_PATH=/usr/bin/ffmpeg
USER node
CMD ["node", "src/server.js"]
