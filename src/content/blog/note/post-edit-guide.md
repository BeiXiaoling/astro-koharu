---
title: 文章修改与置顶指南
link: post-edit-guide
catalog: true
date: 2026-11-18 20:15:00
cover: /img/cover/9.webp
tags:
  - 教程
  - 维护
  - Markdown
categories:
  - 笔记
---

记录这篇文章站上修改已有文章的三种方式、需要重跑哪些步骤，以及置顶与草稿的设置方法。

## 一、三种修改方式

### 方式一：CMS 后台（推荐）

```bash
ssh fnOS@192.168.8.169
cd /vol1/www/astro-koharu
pnpm cms
```

浏览器打开 http://192.168.8.169:4322 ，左侧列出全部文章，点开即可编辑。保存后回到终端按 `Ctrl+C` 停掉服务，再执行构建。

适合：一次要改多篇、或者不熟悉 Markdown 语法。

### 方式二：SSH 直接编辑

```bash
ssh fnOS@192.168.8.169
cd /vol1/www/astro-koharu

# 查看全部文章
find src/content/blog -name '*.md'

# 编辑
nano src/content/blog/note/blog-ops-guide.md
```

适合：只改一两句话，不想启动服务。

### 方式三：本地编辑后上传

```powershell
# 取下来
scp fnOS@192.168.8.169:/vol1/www/astro-koharu/src/content/blog/note/blog-ops-guide.md .\

# 用你习惯的编辑器改完后传回去
scp blog-ops-guide.md fnOS@192.168.8.169:/vol1/www/astro-koharu/src/content/blog/note/
```

适合：需要长时间编辑、或想用 IDE 的语法高亮与预览。

## 二、改完必须重新构建

静态站点不会自动感知文件变化，必须重新构建才会更新到线上：

```bash
cd /vol1/www/astro-koharu
./build.sh
```

约 2–3 分钟（图片缓存命中时）。构建完成后 8080 立即生效，不需要重启 Caddy。

**重要**：改的是 `src/content/blog/` 下的源文件，不要改 `dist/`。`dist/` 每次构建都会被整体覆盖。

## 三、摘要要不要重新生成

文章页顶部的摘要来自 `src/assets/summaries.json`，按「内容哈希 + 模型名」缓存。改了正文或标题，哈希就变了，需要重跑：

```bash
./generate-summaries.sh    # 只处理内容变过的，几秒到十几秒
./build.sh
```

两条连着跑，合计约 3 分钟。如果只改了排版、不关心摘要是否同步，可以跳过第一步。

## 四、frontmatter 字段改动的影响

| 字段 | 改了会怎样 |
| :--- | :--- |
| `title` | 标题、SEO、摘要标题同步变化 |
| `date` | 排序、归档日期、首页时间线变化 |
| `tags` / `categories` | 标签页、分类页归属变化；周刊分类决定是否进 `/weekly/` |
| `link` | **URL 会变，旧链接失效**，慎改 |
| `description` | 只影响 SEO meta 与列表卡片，摘要面板仍优先用 AI 结果 |
| `cover` | 文章封面图 |
| `catalog` | 是否计入分类页的分类树与篇数 |
| `sticky` | 是否置顶到首页独立区域 |
| `draft` | 草稿，生产构建时自动过滤 |
| `excludeFromSummary` | 排除出 AI 摘要与相似度计算 |

## 五、置顶文章

在 frontmatter 里加一行：

```yaml
---
title: 重要公告
sticky: true
---
```

具体行为：

- 首页多出一个「置顶文章」独立区域，置顶内容显示在最上方
- 置顶文章之间按日期排序，最新的在前
- **不影响**分类页、标签页、归档页的排序
- 多篇可以同时置顶
- 取消置顶：改成 `sticky: false` 或删掉这一行

完整示例：

```yaml
---
title: 站点迁移公告
link: site-migration
catalog: true
date: 2026-11-18 20:00:00
sticky: true
cover: /img/cover/2.webp
tags:
  - 公告
categories:
  - 随笔
---
```

改完同样需要 `./build.sh`。

## 六、草稿

写一半不想发布时，加：

```yaml
draft: true
```

- `pnpm dev` 预览时可见，卡片右上角显示 `DRAFT`
- `pnpm build` 生产构建时自动过滤，不出现在任何列表与页面

## 七、改完如何确认

```bash
# 构建有无报错
tail -20 /tmp/build*.log

# 目标页面是否正常
curl -s -o /dev/null -w '%{http_code}\n' http://192.168.8.169:8080/post/post-edit-guide/

# 全站自检
./verify.sh
```

## 八、一句话流程

```bash
cd /vol1/www/astro-koharu
nano src/content/blog/note/xxx.md    # 改
./generate-summaries.sh              # 更新摘要
./build.sh                           # 发布
```

需要置顶就在 frontmatter 加 `sticky: true`，想先藏起来就加 `draft: true`。
