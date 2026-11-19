#!/bin/sh
# 上游升级后重新应用本地补丁（幂等，可重复执行）
set -eu
export PATH=/opt/node22/bin:$PATH
cd "$(dirname "$0")"
echo "应用本地补丁 ..."
node patches/apply.mjs
