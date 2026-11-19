#!/usr/bin/env node
/**
 * 把 content-custom/assets 下的视觉资源同步到 public/
 * 覆盖对象：favicon、apple-touch-icon、头像、顶图 4 档、默认封面
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'content-custom/assets';

if (!fs.existsSync(ROOT)) {
  console.log('  - 未找到 content-custom/assets，跳过');
  process.exit(0);
}

const FILES = [
  ['icons/favicon.ico', 'public/favicon.ico'],
  ['icons/apple-touch-icon.png', 'public/apple-touch-icon.png'],
  ['icons/icon-192.png', 'public/icon-192.png'],
  ['avatar.webp', 'public/img/avatar.webp'],
];

let count = 0;

for (const [src, dst] of FILES) {
  const s = path.join(ROOT, src);
  if (!fs.existsSync(s)) {
    console.log(`  ! 缺少 ${src}`);
    continue;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(s, dst);
  count++;
}

function copyDir(sub, dstDir) {
  const dir = path.join(ROOT, sub);
  if (!fs.existsSync(dir)) return 0;
  fs.mkdirSync(dstDir, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(webp|png|jpe?g|ico|svg)$/i.test(f)) continue;
    fs.copyFileSync(path.join(dir, f), path.join(dstDir, f));
    n++;
  }
  return n;
}

const heroN = copyDir('hero', 'public/img');
const coverN = copyDir('covers', 'public/img/cover-custom');
if (heroN) console.log(`  · 顶图 ${heroN} 档`);
if (coverN) console.log(`  · 默认封面 ${coverN} 张`);

console.log(`  ✅ 视觉资源已同步（${count + heroN + coverN} 个文件）`);
