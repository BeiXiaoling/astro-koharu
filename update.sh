#!/bin/sh
# 升级 astro-koharu 到上游最新版本
#
# 设计说明：
#   不使用 git stash（fnOS 上权限/大量文件容易导致 stash 异常），
#   改为「备份数据 → 丢弃补丁改动 → pull → apply.mjs 重打 → 恢复数据 → 自检」。
#   本地脚本、自建文章、音乐、.env.summary 已加入 .git/info/exclude，pull 不会碰。
#   音乐歌单由 sync-music.sh 生成，即使被上游覆盖也能自动重建。
set -eu
export PATH=/opt/node22/bin:$PATH
cd "$(dirname "$0")"

STAMP=$(date '+%Y%m%d-%H%M%S')
SUMMARY_BAK="/tmp/summaries-$STAMP.json"
CONFIG_BAK="/tmp/site-$STAMP.yaml"
MUSIC_BAK="/tmp/music-md-$STAMP.md"
OLD_REV=$(git rev-parse --short HEAD)

echo "[1/9] 备份数据与配置 ..."
[ -f src/assets/summaries.json ] && cp src/assets/summaries.json "$SUMMARY_BAK" \
  && echo "  摘要 -> $SUMMARY_BAK"
[ -f config/site.yaml ] && cp config/site.yaml "$CONFIG_BAK" \
  && echo "  配置 -> $CONFIG_BAK"
[ -f src/pages/music.md ] && cp src/pages/music.md "$MUSIC_BAK" \
  && echo "  歌单 -> $MUSIC_BAK"

echo "[2/9] 丢弃本地补丁改动（稍后由 apply.mjs 重打）..."
git --literal-pathspecs checkout -- \
  cms/server.ts \
  package.json \
  src/scripts/generateSummaries.ts \
  'src/pages/post/[...slug].astro' \
  src/pages/music.md \
  config/site.yaml 2>/dev/null || echo "  (部分文件本来就未修改)"
echo "  （music.md 与 bgm 配置稍后由 sync-music.sh 重建；site.yaml 其他改动请对比 /tmp 备份）"

echo "[3/9] 拉取上游代码 ..."
if ! git pull --ff-only; then
  echo ""
  echo "!! 快进失败。可能原因：本地有提交或历史分叉。"
  echo "   排查： git log --oneline -5 / git status"
  echo "   备份: $CONFIG_BAK / $SUMMARY_BAK / $MUSIC_BAK"
  exit 1
fi
NEW_REV=$(git rev-parse --short HEAD)
echo "  版本: $OLD_REV -> $NEW_REV"
[ "$OLD_REV" = "$NEW_REV" ] && echo "  （已是最新，无新提交）"

echo "[4/9] 重新应用本地补丁 ..."
node patches/apply.mjs

echo "[5/9] 检查站点配置 ..."
if [ -f "$CONFIG_BAK" ]; then
  if cmp -s config/site.yaml "$CONFIG_BAK"; then
    echo "  site.yaml 无变化"
  else
    echo "  !! site.yaml 被上游更新覆盖，备份在: $CONFIG_BAK"
    echo "     差异: diff config/site.yaml $CONFIG_BAK"
  fi
fi

echo "[6/9] 恢复 AI 摘要数据 ..."
if [ -f "$SUMMARY_BAK" ]; then
  cp "$SUMMARY_BAK" src/assets/summaries.json
  echo "  已恢复"
fi

echo "[7/9] 重建站点配置与歌单 ..."
if ./sync.sh > /tmp/sync.log 2>&1; then
  echo "  已按 config/personal.yaml 与 public/music/ 重建站点配置与歌单"
else
  echo "  ! 同步失败，日志: /tmp/sync.log"
  if [ -f "$MUSIC_BAK" ]; then
    cp "$MUSIC_BAK" src/pages/music.md
    echo "  已回退到升级前的 music.md"
  fi
fi

echo "[8/9] 安装依赖并构建 ..."
pnpm install --frozen-lockfile --prod=false
pnpm build

echo "[9/9] 部署自检 ..."
if ./verify.sh; then
  echo ""
  echo "======================================"
  echo "✅ 升级完成： http://192.168.8.169:8080/"
  echo "======================================"
else
  echo ""
  echo "======================================"
  echo "⚠️  自检发现异常，建议回滚："
  echo "   git reset --hard $OLD_REV"
  echo "   ./reapply-patches.sh && ./sync-music.sh && ./build.sh"
  echo "======================================"
  exit 1
fi
