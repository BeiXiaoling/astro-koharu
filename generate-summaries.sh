#!/bin/sh
# 生成 AI 摘要（读取 .env.summary 中的 API 配置）
# 注意：直接调用底层 tsx 脚本，跳过 koharu CLI 的交互式 TUI
set -eu
export PATH=/opt/node22/bin:$PATH
cd "$(dirname "$0")"

if [ -f .env.summary ]; then
  set -a
  . ./.env.summary
  set +a
fi

if [ -z "${SUMMARY_API_BASE_URL:-}" ] || [ -z "${SUMMARY_API_KEY:-}" ]; then
  echo "缺少配置：请先填写 .env.summary" >&2
  exit 2
fi

echo "Provider : $SUMMARY_API_BASE_URL"
echo "Model    : ${SUMMARY_MODEL:-（脚本默认）}"
echo ""

pnpm exec tsx src/scripts/generateSummaries.ts "$@"
