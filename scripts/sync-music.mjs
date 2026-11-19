#!/usr/bin/env node
/**
 * 扫描 public/music/ 生成歌单页与 BGM 配置
 * 用法: ./sync-music.sh
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'public/music';
const EXT = /\.(mp3|m4a|flac|ogg|wav|aac|opus)$/i;

if (!fs.existsSync(DIR)) {
  fs.mkdirSync(DIR, { recursive: true });
}

const files = fs
  .readdirSync(DIR)
  .filter((f) => EXT.test(f) && fs.statSync(path.join(DIR, f)).isFile())
  .sort((a, b) => a.localeCompare(b, 'zh-CN'));

if (files.length === 0) {
  console.log(`目录 ${DIR} 中没有音频文件。`);
  console.log('请把 mp3 / m4a / flac / ogg / wav / aac / opus 放进去后重跑。');
  process.exit(0);
}

const enc = (f) => `/music/${encodeURIComponent(f)}`;

/* 歌单页：list 项缩进 4 空格 */
const mdList = files.map((f) => `    - ${enc(f)}`).join('\n');

const md = `---
layout: ../layouts/PageLayout.astro
title: "歌单"
description: "我喜欢的音乐"
---

本地音乐，共 ${files.length} 首。

{% media audio %}
- title: 我的歌单
  list:
${mdList}
{% endmedia %}
`;
fs.writeFileSync('src/pages/music.md', md);
console.log(`✅ music.md 已生成（${files.length} 首）`);

/* BGM 配置：- title 缩进 4，list 缩进 6，列表项缩进 8 */
const yamlList = files.map((f) => `        - ${enc(f)}`).join('\n');
const block = `    - title: 我的歌单\n      list:\n${yamlList}`;

const CFG = 'config/site.yaml';
let cfg = fs.readFileSync(CFG, 'utf8');
const re = /(\n  audio:\n)([\s\S]*?)(\n\nchristmas:)/;

if (re.test(cfg)) {
  cfg = cfg.replace(re, (_m, head, _old, tail) => `${head}${block}${tail}`);
  fs.writeFileSync(CFG, cfg);
  console.log('✅ site.yaml 的 bgm.audio 已更新');
} else {
  console.log('⚠️  未能定位 bgm.audio 段，请手动修改 config/site.yaml');
}

console.log('\n曲目：');
files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
console.log('\n下一步: ./build.sh');
