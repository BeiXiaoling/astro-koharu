#!/usr/bin/env node
/**
 * astro-koharu 本地补丁（幂等）
 * 每次上游升级后执行：node patches/apply.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
process.chdir(ROOT);

let failed = 0;
const log = (s) => console.log(s);

/* ---------- 补丁 1：CMS 放行局域网 RFC1918 私有网段 ---------- */
const CMS_FILE = 'cms/server.ts';
if (!fs.existsSync(CMS_FILE)) {
  log('  - 跳过 CMS 补丁（未找到 cms/server.ts）');
} else {
  const src = fs.readFileSync(CMS_FILE, 'utf8');
  if (src.includes('isAllowedHost')) {
    log('  = cms/server.ts 已含局域网补丁');
  } else {
    const oldBlock = [
      "    const host = c.req.header('host') || '';",
      "    const isLocalhost = /^(localhost|127\\.0\\.0\\.1|::1)(:\\d+)?$/.test(host);",
      '    if (!isLocalhost) {',
      "      return c.json({ error: 'CMS is only accessible from localhost' }, 403);",
      '    }',
    ].join('\n');
    const newBlock = [
      '    // fnOS 补丁：放行 RFC1918 私有网段，允许直接用 NAS 局域网 IP 访问 CMS。',
      '    // 公网域名等非私有来源仍被拒绝，保留 anti-DNS-rebinding 防护。',
      "    const host = c.req.header('host') || '';",
      "    const hostname = host.split(':')[0];",
      '    const isAllowedHost =',
      '      /^(localhost|127\\.0\\.0\\.1|::1)$/.test(hostname) ||',
      '      /^192\\.168\\.\\d{1,3}\\.\\d{1,3}$/.test(hostname) ||',
      '      /^10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$/.test(hostname) ||',
      '      /^172\\.(1[6-9]|2\\d|3[01])\\.\\d{1,3}\\.\\d{1,3}$/.test(hostname);',
      '    if (!isAllowedHost) {',
      "      return c.json({ error: 'CMS is only accessible from localhost or LAN' }, 403);",
      '    }',
    ].join('\n');
    if (src.includes(oldBlock)) {
      fs.writeFileSync(CMS_FILE, src.replace(oldBlock, newBlock));
      log('  + cms/server.ts 已打上局域网补丁');
    } else {
      log('  ! 未能匹配 cms/server.ts 的 Host 校验代码，请手动处理');
      failed++;
    }
  }
}

/* ---------- 补丁 2：pnpm dev 绑定 0.0.0.0 ---------- */
const PKG_FILE = 'package.json';
try {
  const pkg = JSON.parse(fs.readFileSync(PKG_FILE, 'utf8'));
  const dev = pkg.scripts?.dev ?? '';
  if (dev.includes('--host')) {
    log('  = package.json dev 已绑定 host');
  } else if (dev.includes('astro dev')) {
    pkg.scripts.dev = `${dev} --host 0.0.0.0 --port 4321`;
    fs.writeFileSync(PKG_FILE, `${JSON.stringify(pkg, null, 2)}\n`);
    log(`  + package.json dev 已改为：${pkg.scripts.dev}`);
  } else {
    log('  ! package.json 的 dev 脚本结构异常，请手动处理');
    failed++;
  }
} catch (e) {
  log(`  ! package.json 处理失败：${e.message}`);
  failed++;
}

/* ---------- 补丁 3+4：AI 摘要支持环境变量 + 连通性检查带认证 ---------- */
const SUM_FILE = 'src/scripts/generateSummaries.ts';
if (!fs.existsSync(SUM_FILE)) {
  log('  - 跳过 AI 摘要补丁（未找到 generateSummaries.ts）');
} else {
  let src = fs.readFileSync(SUM_FILE, 'utf8');

  if (src.includes('SUMMARY_API_BASE_URL')) {
    log('  = generateSummaries.ts 已支持环境变量');
  } else {
    const oldCfg = [
      "const API_BASE_URL = 'http://127.0.0.1:1234/v1/';",
      "const API_KEY = 'lm-studio'; // LM Studio doesn't require a real key",
      "const DEFAULT_MODEL = 'qwen/qwen3-4b-2507';",
    ].join('\n');
    const newCfg = [
      '// fnOS 补丁：改为读取环境变量，支持任意 OpenAI 兼容服务',
      '// （DeepSeek / 硅基流动 / 智谱 / OpenAI / Ollama / LM Studio 均可）',
      "const API_BASE_URL = process.env.SUMMARY_API_BASE_URL || 'http://127.0.0.1:1234/v1/';",
      "const API_KEY = process.env.SUMMARY_API_KEY || 'lm-studio';",
      "const DEFAULT_MODEL = process.env.SUMMARY_MODEL || 'qwen/qwen3-4b-2507';",
    ].join('\n');
    if (src.includes(oldCfg)) {
      src = src.replace(oldCfg, newCfg);
      fs.writeFileSync(SUM_FILE, src);
      log('  + generateSummaries.ts 已支持 SUMMARY_* 环境变量');
    } else {
      log('  ! 未能匹配 generateSummaries.ts 的 API 配置，请手动处理');
      failed++;
    }
  }

  if (src.includes('Authorization: `Bearer ${API_KEY}`')) {
    log('  = generateSummaries.ts 连通性检查已带认证');
  } else {
    const oldCheck = '    const response = await fetch(`${API_BASE_URL}models`);';
    const newCheck = [
      '    const response = await fetch(`${API_BASE_URL}models`, {',
      '      headers: { Authorization: `Bearer ${API_KEY}` },',
      '    });',
    ].join('\n');
    if (src.includes(oldCheck)) {
      src = src.replace(oldCheck, newCheck);
      fs.writeFileSync(SUM_FILE, src);
      log('  + generateSummaries.ts 连通性检查已带认证头');
    } else {
      log('  ! 未能匹配连通性检查代码，请手动处理');
      failed++;
    }
  }
}

/* ---------- 补丁 5：文章页 AI 摘要优先于手写 description ---------- */
const POST_PAGE = 'src/pages/post/[...slug].astro';
if (!fs.existsSync(POST_PAGE)) {
  log('  - 跳过摘要优先级补丁（未找到 post/[...slug].astro）');
} else {
  const src = fs.readFileSync(POST_PAGE, 'utf8');
  if (src.includes('AI 摘要优先于手写 description')) {
    log('  = 文章页摘要已 AI 优先');
  } else {
    const oldLogic = [
      'if (post.data.description) {',
      '  // 优先使用手写描述',
      '  summaryText = post.data.description;',
      "  summarySource = 'description';",
      '} else {',
      '  // 尝试获取 AI 摘要',
      '  const aiSummary = getPostSummary(postSlug);',
      '  if (aiSummary) {',
      '    summaryText = aiSummary;',
      "    summarySource = 'ai';",
      '  } else {',
      '    // 降级到自动提取',
      "    summaryText = extractTextFromMarkdown(post.body ?? '', 200);",
      "    summarySource = 'auto';",
      '  }',
      '}',
    ].join('\n');

    const newLogic = [
      '// fnOS 补丁：AI 摘要优先于手写 description，无摘要时再回退到描述与自动提取',
      'const aiSummary = getPostSummary(postSlug);',
      'if (aiSummary) {',
      '  summaryText = aiSummary;',
      "  summarySource = 'ai';",
      '} else if (post.data.description) {',
      '  summaryText = post.data.description;',
      "  summarySource = 'description';",
      '} else {',
      "  summaryText = extractTextFromMarkdown(post.body ?? '', 200);",
      "  summarySource = 'auto';",
      '}',
    ].join('\n');

    if (src.includes(oldLogic)) {
      fs.writeFileSync(POST_PAGE, src.replace(oldLogic, newLogic));
      log('  + 文章页摘要已改为 AI 优先');
    } else {
      log('  ! 未能匹配 post/[...slug].astro 的摘要优先级逻辑，请手动处理');
      failed++;
    }
  }
}

/* ---------- 补丁 6：音频直链（本地音乐）---------- */
const METING_FILE = 'src/lib/meting.ts';
if (!fs.existsSync(METING_FILE)) {
  log('  - 跳过音频直链补丁（未找到 lib/meting.ts）');
} else {
  let m = fs.readFileSync(METING_FILE, 'utf8');
  if (m.includes('支持音频直链')) {
    log('  = meting.ts 已支持音频直链');
  } else {
    const oldBlock = [
      '      const parsed = parseMusicUrl(url);',
      '      if (!parsed) return Promise.resolve([]);',
    ].join('\n');
    const newBlock = [
      '      const parsed = parseMusicUrl(url);',
      '      if (!parsed) {',
      '        // fnOS 补丁：支持音频直链（本地音乐等），以文件名作为曲名',
      '        if (/\\.(mp3|m4a|flac|ogg|wav|aac|opus)(\\?|#|$)/i.test(url)) {',
      "          const base = url.split('?')[0].split('#')[0].split('/').pop() || '';",
      "          const name = decodeURIComponent(base.replace(/\\.[^.]+$/, '')) || '本地音乐';",
      "          return Promise.resolve([{ name, artist: '', url, pic: '', lrc: '' }] as MetingSong[]);",
      '        }',
      '        return Promise.resolve([]);',
      '      }',
    ].join('\n');
    if (m.includes(oldBlock)) {
      fs.writeFileSync(METING_FILE, m.replace(oldBlock, newBlock));
      log('  + meting.ts 已支持音频直链');
    } else {
      log('  ! 未匹配 resolvePlaylist 代码，请手动处理');
      failed++;
    }
  }
}

/* ---------- 补丁 7：修正 favicon MIME 并补 apple-touch-icon ---------- */
const HEAD_META = 'src/layouts/HeadMeta.astro';
if (!fs.existsSync(HEAD_META)) {
  log('  - 跳过 favicon 补丁（未找到 HeadMeta.astro）');
} else {
  let h = fs.readFileSync(HEAD_META, 'utf8');
  if (h.includes('apple-touch-icon')) {
    log('  = favicon 链接已修正');
  } else {
    const oldLine = '<link rel="icon" type="image/svg+xml" href="/favicon.ico" />';
    const newLines = [
      '<link rel="icon" type="image/x-icon" href="/favicon.ico" />',
      '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
      '<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />',
    ].join('\n');
    if (h.includes(oldLine)) {
      fs.writeFileSync(HEAD_META, h.replace(oldLine, newLines));
      log('  + HeadMeta.astro 已修正 favicon 链接');
    } else {
      log('  ! 未能匹配 favicon link 行，请手动处理');
      failed++;
    }
  }
}

/* ---------- 结果 ---------- */
if (failed > 0) {
  log(`\n⚠️  有 ${failed} 项需要手动处理`);
  process.exit(1);
}
log('\n✅ 本地补丁已全部就位');
