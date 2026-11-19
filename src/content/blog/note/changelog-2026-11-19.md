---
title: 变更记录：关于页与友链纳入同步管理
link: changelog-2026-11-19
catalog: true
date: 2026-11-19 15:15:00
cover: /img/cover/5.webp
tags:
  - 变更记录
  - 运维
  - 配置
categories:
  - 笔记
---

昨天把站点标题、音乐歌单纳入脚本管理之后，顺手检查了其余页面，发现关于页和友链同样脆弱——都是 git 跟踪文件，升级时会被丢弃。这篇记录处理过程。

## 一、问题在哪

站点的可定制内容大致分三类：

| 类型 | 位置 | 升级时的命运 |
| :--- | :--- | :--- |
| 站点基础信息 | `site.yaml` 的 `site` 段 | 被丢弃 |
| 页面文案与数据 | `site.yaml` 的 `friends` 段 | 被丢弃 |
| 独立页面 | `src/pages/about.md` | 被丢弃 |

`update.sh` 为了能干净地 `pull`，第 2 步会主动丢弃这些文件的本地改动。如果没有重建机制，升级后所有定制都会消失。

昨天已经解决了 `site` 段（`personal.yaml` → `sync.sh`）和音乐歌单（`public/music/` → `sync-music.mjs`），剩下两块没覆盖：

- 关于页的正文和 frontmatter
- 友链的分组、文案、列表

## 二、做法

延续同一套思路：**本地文件做权威来源，脚本写回被跟踪的文件**。

| 本地文件 | 同步目标 | 方式 |
| :--- | :--- | :--- |
| `content-custom/about.md` | `src/pages/about.md` | 直接覆盖 |
| `config/friends.yaml` | `site.yaml` 的 `friends:` 段 | 整段替换 |

两个新文件都加入了 `.git/info/exclude`，升级时不受影响。

### 友链整段替换的实现

友链是一个嵌套结构（分组建数组），逐字段替换不现实，改为按段边界整体替换：

```js
const re = /^friends:[\s\S]*?(?=^[a-z])/m;
text = text.replace(re, () => `${block}\n\n`);
```

匹配从 `friends:` 开头到「下一个顶级小写键」之前的所有内容。因为 YAML 里数组项以 `-` 开头、子字段以空格开头，不会误判边界。

替换的是**原始文本**而不是重新序列化的 YAML，所以缩进、引号、注释风格都能保留下来。

### 关于页直接覆盖

关于页没有嵌套结构，`copyFileSync` 就够了。这样 Markdown 正文里的任何写法（HTML、图片、徽章）都能原样保留。

## 三、验证

光写完脚本不算数，得证明它真能重建。演练方式是**先破坏，再修复**：

```bash
# 全部回退到上游原版
git checkout -- config/site.yaml src/pages/about.md
```

回退后状态：

| 项 | 值 |
| :--- | :--- |
| `site.title` | 余弦の博客（上游默认） |
| `site.author` | Author（上游默认） |
| `about` | 主题作者的自我介绍 |

然后执行 `./sync.sh`：

| 项 | 恢复后 |
| :--- | :--- |
| `site.title` | Aha |
| `site.author` | x24moe |
| `site.url` | https://www.x24moe.com |
| `bangumi.userId` | x24moe |
| 友链 | 8 条 / 3 组 |
| BGM 音频 | 4 首 |

再用 YAML 解析器验证结构没有被破坏：`navigation` 7 条、`friends` 8 条、`bgm` 1 组，全部正常。构建 123 页，首页、关于页、友链页都返回 200。

## 四、sync.sh 现在管什么

一次执行覆盖 16 项：

| 来源 | 目标 | 内容 |
| :--- | :--- | :--- |
| `personal.yaml` · site | `site.yaml` | 13 个基础字段 |
| `personal.yaml` · bangumi | `site.yaml` | 追番用户 |
| `friends.yaml` | `site.yaml` | 友链整段 |
| `content-custom/about.md` | `src/pages/about.md` | 关于页 |
| `public/music/` | `music.md` + `bgm.audio` | 歌单 |

## 五、一点取舍

把内容拆成多个本地文件，代价是「找东西要记路径」；收益是升级零成本，且每个文件职责单一。

另一种做法是保留这些文件为 git 跟踪、在 `update.sh` 里加备份恢复逻辑。但那样每次 pull 都要处理冲突，而且恢复顺序容易出错。用脚本重建更彻底：**被跟踪的文件永远可以丢，丢完一条命令就回来**。

下一步如果还有页面需要定制（比如留言板、项目页），照这个模式加一行同步规则即可。
