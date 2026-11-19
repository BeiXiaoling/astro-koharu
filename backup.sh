#!/bin/sh
# 一键打包备份（保留最近 5 份）
set -eu
cd "$(dirname "$0")"

STAMP=$(date '+%Y%m%d-%H%M%S')
OUT_DIR=/vol1/www/backups
OUT="$OUT_DIR/astro-koharu-$STAMP.tar.gz"
mkdir -p "$OUT_DIR"

cd ..
echo "打包中 ..."
tar -czf "$OUT" \
  --exclude='astro-koharu/node_modules' \
  --exclude='astro-koharu/dist' \
  --exclude='astro-koharu/.astro' \
  --exclude='astro-koharu/.cache' \
  --exclude='astro-koharu/cms/node_modules' \
  astro-koharu

echo ""
echo "✅ 备份完成"
echo "  路径: $OUT"
echo "  大小: $(du -h "$OUT" | cut -f1)"
echo "  文章: $(tar -tzf "$OUT" | grep -c 'src/content/blog/.*\.md$') 篇"
echo "  SHA256: $(sha256sum "$OUT" | cut -d' ' -f1)"

# 只保留最近 5 份
COUNT=$(ls -1 "$OUT_DIR"/astro-koharu-*.tar.gz 2>/dev/null | wc -l)
if [ "$COUNT" -gt 5 ]; then
  ls -1t "$OUT_DIR"/astro-koharu-*.tar.gz | tail -n +6 | xargs -r rm -f
  echo "  （已清理旧备份，保留最近 5 份）"
fi

echo ""
echo "取回本地:"
echo "  scp fnOS@192.168.8.169:$OUT ./"
