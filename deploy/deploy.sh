#!/usr/bin/env bash
# 一键部署：本地构建 → 上传 → 远程初始化并启动
# 用法：deploy/deploy.sh root@1.2.3.4 [ssh 端口]
set -euo pipefail
HOST="${1:?用法：deploy/deploy.sh user@host [port]}"
SSH_PORT="${2:-22}"
APP_DIR="${APP_DIR:-/opt/xueji}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

"$ROOT/deploy/build.sh"
echo "==> 上传到 $HOST:$APP_DIR"
ssh -p "$SSH_PORT" "$HOST" "mkdir -p $APP_DIR"
rsync -az --delete -e "ssh -p $SSH_PORT" \
  --exclude 'server/node_modules' --exclude 'server/prisma/xueji.db' --exclude 'server/.env' \
  "$ROOT/deploy/.bundle/" "$HOST:$APP_DIR/"
ssh -p "$SSH_PORT" "$HOST" "APP_DIR=$APP_DIR RESEED=${RESEED:-0} bash $APP_DIR/remote-setup.sh"
