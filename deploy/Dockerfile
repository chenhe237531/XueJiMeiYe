# 雪姬美业六维健康平台 · 运行镜像
# 前端（管理端、小程序 H5）在本地构建后随部署包上传；镜像内只安装 API 依赖（VPS 内存小，不在服务器上构建前端）
FROM node:22-bookworm-slim

ENV TZ=Asia/Shanghai \
    NODE_ENV=production \
    WEB_ROOT=/app \
    PORT=3000 \
    DATABASE_URL=file:/data/xueji.db

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates tzdata \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app/server
COPY server/package.json ./
RUN npm install --include=dev --no-audit --no-fund --loglevel=error

COPY server/prisma ./prisma
RUN npx prisma generate

COPY server/tsconfig.json ./
COPY server/src ./src
COPY server/dist ./dist
COPY admin/dist /app/admin/dist
COPY miniapp/dist/build/h5 /app/miniapp/dist/build/h5
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# 使用专用 uid 10001（避免与宿主机已有用户 uid 1000 重叠）
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
 && mkdir -p /data && chown -R 10001:10001 /data

ENV HOME=/tmp
USER 10001:10001
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/app/about').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["docker-entrypoint.sh"]
