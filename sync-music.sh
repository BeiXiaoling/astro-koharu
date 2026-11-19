#!/bin/sh
# 同步本地音乐到歌单页与 BGM 配置
set -eu
export PATH=/opt/node22/bin:$PATH
cd "$(dirname "$0")"
node scripts/sync-music.mjs
