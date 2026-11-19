#!/bin/sh
# 重新构建并发布博客（改完配置或文章后执行）
set -eu
export PATH=/opt/node22/bin:$PATH
cd "$(dirname "$0")"

echo "[1/2] 内容迁移检查 ..."
pnpm koharu migrate --check

echo "[2/2] 构建静态站（约 6-8 分钟）..."
pnpm build

echo ""
echo "✅ 构建完成，已生效： http://192.168.8.169:8080/"
