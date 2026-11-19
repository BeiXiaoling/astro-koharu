#!/bin/sh
# 停止 dev 预览 / CMS 服务
# 用法: ./stop.sh         停止全部
#       ./stop.sh cms     只停 CMS (4322)
#       ./stop.sh dev     只停预览 (4321)
set -u

TARGET="${1:-all}"

port_pid() {
  ss -tlnp 2>/dev/null | grep ":$1 " | grep -oE 'pid=[0-9]+' | cut -d= -f2 | head -1
}

stop_one() {
  PORT="$1"
  NAME="$2"
  PATTERN="$3"

  if [ -z "$(port_pid "$PORT")" ]; then
    printf '  %-6s : 未运行\n' "$NAME"
    return 0
  fi

  # pnpm 会 fork 多级子进程，按命令行特征整组终止
  pkill -f "$PATTERN" 2>/dev/null
  sleep 2

  PID="$(port_pid "$PORT")"
  if [ -n "$PID" ]; then
    kill -9 "$PID" 2>/dev/null
    sleep 1
  fi

  if [ -n "$(port_pid "$PORT")" ]; then
    printf '  %-6s : 停止失败（%s 仍被占用）\n' "$NAME" "$PORT"
  else
    printf '  %-6s : 已停止\n' "$NAME"
  fi
}

echo "停止服务 ..."
case "$TARGET" in
  cms) stop_one 4322 CMS 'tsx server.ts' ;;
  dev) stop_one 4321 预览 'astro.*dev' ;;
  all)
    stop_one 4322 CMS 'tsx server.ts'
    stop_one 4321 预览 'astro.*dev'
    ;;
  *)
    echo "用法: $0 [cms|dev|all]" >&2
    exit 2
    ;;
esac

echo
echo "当前监听:"
ss -tlnp 2>/dev/null | grep -E ':(4321|4322|8080)' | sed 's/^/  /' || echo "  (无)"
echo
free -h | head -2 | sed 's/^/  /'
