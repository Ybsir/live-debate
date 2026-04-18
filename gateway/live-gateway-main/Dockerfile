# 构建上下文须为仓库根目录 live-debate/：docker compose build / docker build -f gateway/live-gateway-main/Dockerfile .
FROM node:20-alpine
WORKDIR /app
COPY gateway/live-gateway-main/package.json gateway/live-gateway-main/package-lock.json* ./
RUN npm install --omit=dev
COPY gateway/live-gateway-main/ ./
COPY frontend/Live-main/static ./static-assets
ENV ADMIN_STATIC_ROOT=/app/static-assets
EXPOSE 8080
CMD ["node", "gateway.js"]
