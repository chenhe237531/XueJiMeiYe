#!/usr/bin/env bash
# 在 VPS 上执行：安装 Node / pm2、安装 API 依赖、初始化数据库、启动服务
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/xueji}"
PORT="${PORT:-3000}"
cd "$APP_DIR"

if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  echo "==> 安装 Node.js 22"
  if command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs
  elif command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - && (dnf install -y nodejs || yum install -y nodejs)
  else
    echo "请先手动安装 Node.js 20+"; exit 1
  fi
fi
command -v pm2 >/dev/null 2>&1 || npm i -g pm2 --registry=https://registry.npmmirror.com

echo "==> 安装 API 依赖"
cd "$APP_DIR/server"
[ -f .env ] || cat > .env <<ENV
DATABASE_URL="file:./xueji.db"
PORT=$PORT
JWT_SECRET=$(head -c 24 /dev/urandom | base64 | tr -dc A-Za-z0-9 | head -c 32)
AI_BASE_URL=
AI_API_KEY=
AI_MODEL=
ENV
npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma npx prisma generate
if [ ! -f prisma/xueji.db ] || [ "${RESEED:-0}" = "1" ]; then
  echo "==> 初始化演示数据"
  rm -f prisma/xueji.db
  npx prisma db push --skip-generate
  npx ts-node --transpile-only prisma/seed.ts
else
  npx prisma db push --skip-generate
fi

echo "==> 启动服务（pm2）"
cd "$APP_DIR"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save >/dev/null
echo "==> 完成：http://<服务器IP>:$PORT/  管理端；http://<服务器IP>:$PORT/h5/  小程序 H5 版"
