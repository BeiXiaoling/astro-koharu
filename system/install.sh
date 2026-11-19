#!/bin/sh
# 安装 Caddy 配置与 systemd 服务（幂等，需 root）
# 用法: sudo ./system/install.sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 运行：sudo $0" >&2
  exit 1
fi

DIR=$(cd "$(dirname "$0")" && pwd)
PROJECT=$(cd "$DIR/.." && pwd)
SERVICE_USER=${SERVICE_USER:-$(stat -c '%U' "$PROJECT")}
SERVICE_GROUP=$(id -gn "$SERVICE_USER" 2>/dev/null || echo Users)

echo "项目路径 : $PROJECT"
echo "服务用户 : $SERVICE_USER:$SERVICE_GROUP"

CADDY_BIN=""
for p in /usr/local/bin/caddy /usr/bin/caddy; do
  [ -x "$p" ] && CADDY_BIN="$p" && break
done
if [ -z "$CADDY_BIN" ]; then
  echo "" >&2
  echo "!! 未安装 Caddy。arm64 安装命令：" >&2
  echo "   cd /tmp && curl -sL -o caddy.tgz https://github.com/caddyserver/caddy/releases/download/v2.11.9/caddy_2.11.9_linux_arm64.tar.gz" >&2
  echo "   tar -xzf caddy.tgz caddy && mv caddy /usr/local/bin/ && chmod +x /usr/local/bin/caddy" >&2
  exit 1
fi
echo "Caddy    : $CADDY_BIN ($($CADDY_BIN version | cut -d' ' -f1))"

echo ""
echo "[1/5] 写入 /etc/caddy/Caddyfile（按实际项目路径生成）..."
mkdir -p /etc/caddy
sed "s#^[[:space:]]*root \* .*#\troot * $PROJECT/dist#" "$DIR/caddy/Caddyfile" > /etc/caddy/Caddyfile
grep -E '^\s*root' /etc/caddy/Caddyfile

echo "[2/5] 写入 systemd 服务（按实际用户生成）..."
sed -e "s#^User=.*#User=$SERVICE_USER#" \
    -e "s#^Group=.*#Group=$SERVICE_GROUP#" \
    "$DIR/systemd/caddy-koharu.service" > /etc/systemd/system/caddy-koharu.service
grep -E '^(User|Group|ExecStart)=' /etc/systemd/system/caddy-koharu.service

echo "[3/5] 准备数据目录 ..."
mkdir -p /var/lib/caddy
chown -R "$SERVICE_USER:$SERVICE_GROUP" /var/lib/caddy 2>/dev/null || true

echo "[4/5] 重载并启用服务 ..."
systemctl daemon-reload
systemctl enable caddy-koharu.service >/dev/null 2>&1 || true
systemctl restart caddy-koharu.service
sleep 2

echo "[5/5] 验证 ..."
if systemctl is-active --quiet caddy-koharu.service; then
  IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://127.0.0.1:8080/" || echo 000)
  echo "  服务状态 : active"
  echo "  HTTP     : $CODE"
  if [ "$CODE" = "200" ]; then
    echo ""
    echo "✅ 安装完成： http://${IP:-127.0.0.1}:8080/"
  else
    echo ""
    echo "⚠️  服务已启动但首页返回 $CODE，请确认 $PROJECT/dist 已构建"
  fi
else
  echo "!! 服务启动失败，查看日志： journalctl -u caddy-koharu -n 30 --no-pager" >&2
  exit 1
fi
