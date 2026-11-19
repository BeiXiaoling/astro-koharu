#!/usr/bin/env node
/**
 * 把本地配置写入 config/site.yaml 与 src/pages/
 * 保留 site.yaml 的注释与格式
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const PERSONAL = 'config/personal.yaml';
const TARGET = 'config/site.yaml';
const FRIENDS_SRC = 'config/friends.yaml';
const ABOUT_SRC = 'content-custom/about.md';
const ABOUT_DST = 'src/pages/about.md';

if (!fs.existsSync(TARGET)) {
  console.log(`  - 未找到 ${TARGET}`);
  process.exit(1);
}

let text = fs.readFileSync(TARGET, 'utf8');
let changed = 0;

const personal = fs.existsSync(PERSONAL) ? YAML.parse(fs.readFileSync(PERSONAL, 'utf8')) || {} : {};

/** YAML 裸标量是否需要加引号 */
function quote(v) {
  const s = String(v);
  if (s === '') return "''";
  const unsafe =
    /:\s/.test(s) || /\s#/.test(s) ||
    /^[\s\-\[\]{}&*?|<>=!%@`"'#,>]/.test(s) ||
    /\s$/.test(s) || /[,\[\]]/.test(s);
  return unsafe ? JSON.stringify(s) : s;
}

/** 在指定顶级段内替换某个标量字段，保留行尾注释 */
function setSectionField(section, key, value) {
  const sectionRe = new RegExp(`(^${section}:[^\\n]*\\n)((?:[ \\t]+[^\\n]*\\n|[ \\t]*\\n)*)`, 'm');
  const m = text.match(sectionRe);
  if (!m) {
    console.log(`  ! site.yaml 中未找到 ${section}: 段`);
    return false;
  }
  const body = m[2];
  const fieldRe = new RegExp(`^([ \\t]+${key}:[ \\t]*)([^\\n#]*?)([ \\t]*#[^\\n]*)?$`, 'm');
  if (!fieldRe.test(body)) {
    console.log(`  ! ${section} 段中未找到 ${key}`);
    return false;
  }
  const newBody = body.replace(fieldRe, (_x, head, _old, comment) => `${head}${quote(value)}${comment || ''}`);
  text = text.replace(m[0], () => m[1] + newBody);
  changed++;
  return true;
}

/* ---------- 1. site 段 ---------- */
{
  const site = personal.site || {};
  for (const [key, value] of Object.entries(site)) {
    if (key === 'keywords') continue;
    setSectionField('site', key, value);
  }
  if (Array.isArray(site.keywords) && site.keywords.length > 0) {
    const re = /(^  keywords:[ \t]*#?[^\n]*\n)((?:[ \t]+-[^\n]*\n)*)/m;
    if (re.test(text)) {
      const block = site.keywords.map((k) => `    - ${quote(k)}`).join('\n') + '\n';
      text = text.replace(re, (_m, head) => `${head}${block}`);
      changed++;
    } else {
      console.log('  ! 未找到 site.keywords 数组');
    }
  }
  const bangumi = personal.bangumi || {};
  for (const [key, value] of Object.entries(bangumi)) {
    setSectionField('bangumi', key, value);
  }
}

/* ---------- 2. friends 段整体替换 ---------- */
if (fs.existsSync(FRIENDS_SRC)) {
  const block = fs.readFileSync(FRIENDS_SRC, 'utf8').trim();
  if (!block.startsWith('friends:')) {
    console.log('  ! friends.yaml 必须以 "friends:" 开头，已跳过');
  } else {
    const re = /^friends:[\s\S]*?(?=^[a-z])/m;
    if (re.test(text)) {
      text = text.replace(re, () => `${block}\n\n`);
      changed++;
    } else {
      console.log('  ! site.yaml 中未找到 friends 段');
    }
  }
}

/* ---------- 3. 关于页 ---------- */
if (fs.existsSync(ABOUT_SRC)) {
  fs.mkdirSync(path.dirname(ABOUT_DST), { recursive: true });
  fs.copyFileSync(ABOUT_SRC, ABOUT_DST);
  changed++;
} else {
  console.log(`  - 未找到 ${ABOUT_SRC}，跳过关于页`);
}


/* ---------- 4. defaultCoverList ---------- */
if (Array.isArray(personal.defaultCoverList) && personal.defaultCoverList.length > 0) {
  const block = 'defaultCoverList:\n' + personal.defaultCoverList.map((u) => `  - ${u}`).join('\n') + '\n';
  const reActive = /^defaultCoverList:\n(?:  - [^\n]*\n)*/m;
  const reCommented = /^# defaultCoverList:\n(?:#   - [^\n]*\n)*/m;
  if (reActive.test(text)) {
    text = text.replace(reActive, () => block);
    changed++;
  } else if (reCommented.test(text)) {
    text = text.replace(reCommented, () => block);
    changed++;
  } else {
    console.log('  ! 未找到 defaultCoverList 位置');
  }
}

fs.writeFileSync(TARGET, text);
console.log(`  ✅ 站点配置已同步（${changed} 项）`);
