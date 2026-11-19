#!/bin/sh
# 部署自检：检查 5 个补丁、构建产物、服务状态、摘要数据
# 用法: ./verify.sh      全部通过返回 0，有异常返回非 0
set -u
export PATH=/opt/node22/bin:$PATH
cd "$(dirname "$0")"

FAIL=0
ok()  { printf '  \033[32m✓\033[0m %s\n' "$1"; }
bad() { printf '  \033[31m✗\033[0m %s\n' "$1"; FAIL=$((FAIL + 1)); }

echo "【补丁】"
grep -q 'isAllowedHost' cms/server.ts 2>/dev/null && ok '补丁1  CMS 局域网访问' || bad '补丁1  CMS 局域网访问'
grep -q 'host 0.0.0.0' package.json 2>/dev/null && ok '补丁2  dev 绑定 0.0.0.0' || bad '补丁2  dev 绑定 0.0.0.0'
grep -q 'SUMMARY_API_BASE_URL' src/scripts/generateSummaries.ts 2>/dev/null && ok '补丁3  AI 摘要读环境变量' || bad '补丁3  AI 摘要读环境变量'
grep -q 'Authorization: `Bearer' src/scripts/generateSummaries.ts 2>/dev/null && ok '补丁4  连通性检查带认证' || bad '补丁4  连通性检查带认证'
grep -q 'AI 摘要优先' 'src/pages/post/[...slug].astro' 2>/dev/null && ok '补丁5  摘要面板 AI 优先' || bad '补丁5  摘要面板 AI 优先'

echo "【数据】"
if [ -f .env.summary ]; then
  grep -q '^SUMMARY_API_KEY=sk-' .env.summary && ok 'API Key 已配置' || bad 'API Key 未配置'
else
  bad '.env.summary 不存在'
fi

N=0
[ -f src/assets/summaries.json ] && N=$(node -e "console.log(Object.keys(require('./src/assets/summaries.json')).length)" 2>/dev/null || echo 0)
[ "$N" -gt 0 ] && ok "AI 摘要 $N 条" || bad 'AI 摘要为空'

echo "【构建产物】"
[ -f dist/index.html ] && ok 'dist/index.html' || bad 'dist/index.html 缺失'
[ -f dist/pagefind/pagefind.js ] && ok 'pagefind 搜索索引' || bad 'pagefind 搜索索引缺失'
WH=$(find dist -name 'index.html' 2>/dev/null | wc -l)
[ "$WH" -gt 30 ] && ok "页面 $WH 个" || bad "页面仅 $WH 个（异常）"

echo "【服务】"
systemctl is-active --quiet caddy-koharu 2>/dev/null && ok 'caddy 服务运行中' || bad 'caddy 服务未运行'
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:8080/ 2>/dev/null || echo 000)
[ "$CODE" = "200" ] && ok "博客 :8080 返回 $CODE" || bad "博客 :8080 返回 $CODE"

echo ""
if [ "$FAIL" -eq 0 ]; then
  printf '\033[32m✅ 全部通过\033[0m\n'
  exit 0
fi
printf '\033[31m❌ %s 项异常\033[0m\n' "$FAIL"
echo ""
echo "修复建议："
echo "  补丁缺失 -> ./reapply-patches.sh"
echo "  产物缺失 -> ./build.sh"
echo "  服务异常 -> systemctl restart caddy-koharu"
echo "  摘要为空 -> ./generate-summaries.sh && ./build.sh"
exit 1
