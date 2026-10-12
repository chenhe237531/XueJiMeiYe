#!/bin/sh
# 首次启动初始化演示数据；之后每次启动只同步表结构，数据保存在 /data 卷中
set -e
cd /app/server
if [ ! -f /data/xueji.db ]; then
  echo "[xueji] 初始化数据库与演示数据"
  npx prisma db push --skip-generate
  npx ts-node --transpile-only prisma/seed.ts
else
  npx prisma db push --skip-generate
fi
exec node dist/main.js
