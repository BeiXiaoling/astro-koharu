#!/bin/sh
# 从本地配置与资源重建站点配置、视觉资源、音乐歌单
# 用法: ./sync.sh
set -eu
export PATH=/opt/node22/bin:$PATH
cd "$(dirname "$0")"

echo "→ 同步站点配置 ..."
node scripts/sync-config.mjs

echo "→ 同步视觉资源 ..."
node scripts/sync-assets.mjs

echo "→ 同步音乐歌单 ..."
node scripts/sync-music.mjs || echo "  (无本地音乐，跳过)"
