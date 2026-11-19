---
title: 博客运维操作手册
link: blog-ops-guide
catalog: true
date: 2026-11-18 15:40:00
cover: /img/cover/7.webp
tags:
  - 运维
  - 教程
  - 部署
categories:
  - 笔记
---

本文记录这台设备上 astro-koharu 博客的部署形态与日常操作，方便以后直接查命令。

## 一、访问地址

站点跑在局域网 `192.168.8.169` 上，端口如下：

| 用途 | 地址 | 说明 |
| :--- | :--- | :--- |
| **博客正式站** | http://192.168.8.169:8080 | Caddy 常驻，systemd 守护，开机自启 |
| **预览（热更新）** | http://192.168.8.169:4321 | 需要手动启动，改完即刷新 |
| **CMS 后台** | http://192.168.8.169:4322 | 需要手动启动，图形化写文章 |

三者在同一局域网内访问，不暴露到公网。

## 二、连接设备

```bash
ssh fnOS@192.168.8.169
cd /vol1/www/astro-koharu
```

## 三、日常命令

### 启动 CMS（图形化写文章）

```bash
cd /vol1/www/astro-koharu
pnpm cms
```

启动约 40 秒，浏览器打开 http://192.168.8.169:4322 即可使用。内存占用约 324 MB。

### 启动预览（实时看效果）

```bash
cd /vol1/www/astro-koharu
pnpm dev
```

启动约 1–2 分钟（首次编译较慢），浏览器打开 http://192.168.8.169:4321。改文件后页面自动刷新。内存占用约 700 MB。

### 停止服务

在运行的终端按 `Ctrl+C` 即可。如果终端已关闭，另开一个：

```bash
cd /vol1/www/astro-koharu
./stop.sh          # 停止 CMS 与预览
./stop.sh cms      # 只停 CMS
./stop.sh dev      # 只停预览
```

**注意**：关闭浏览器页面不会停止服务，进程仍在占用内存，必须显式停止。

### 新建文章（交互式）

```bash
cd /vol1/www/astro-koharu
pnpm koharu new post
```

按提示依次输入标题、Slug、描述、分类、标签，会在 `src/content/blog/<分类>/` 下生成带 frontmatter 的 Markdown 文件。

需要在真实终端里执行，管道或脚本中调用会因缺少 TTY 失败。

### 新建文章（手动写文件）

直接在 `src/content/blog/` 下建 `.md` 文件，格式：

```yaml
---
title: 文章标题
link: custom-url          # 可选，自定义路径
catalog: true             # 显示目录
date: 2026-11-18 15:00:00
description: 摘要          # 可选，写了就不走 AI 摘要
cover: /img/cover/7.webp  # 可选封面
tags:
  - 标签
categories:
  - 笔记
---
```

分类目录对应关系见 `config/site.yaml` 的 `categoryMap`，现有：随笔、笔记、工具、周刊、前端、CSS、番剧。

### 生成 AI 摘要

```bash
cd /vol1/www/astro-koharu
./generate-summaries.sh
```

增量执行：已生成过的走缓存，只处理新增或修改过的文章。摘要写入 `src/assets/summaries.json`，**必须重新构建才会显示**。

接口配置在 `.env.summary`（DeepSeek，`deepseek-flash`）。

摘要显示规则（**AI 摘要优先**）：

| 优先级 | 来源 | 面板标注 |
| :--- | :--- | :--- |
| 1 | AI 摘要 | `ai` |
| 2 | frontmatter `description` | `description` |
| 3 | 正文自动提取 | `auto` |

`description` 仍用于列表卡片和 SEO 描述，只是不再覆盖文章页顶部的摘要面板。

### 更换 AI Key 或服务商

配置集中在项目根目录的 `.env.summary`：

```bash
cd /vol1/www/astro-koharu
nano .env.summary
```

三个字段：

| 字段 | 说明 |
| :--- | :--- |
| `SUMMARY_API_BASE_URL` | 接口地址，DeepSeek 为 `https://api.deepseek.com/v1/` |
| `SUMMARY_MODEL` | 模型名，当前 `deepseek-flash` |
| `SUMMARY_API_KEY` | `sk-` 开头的密钥 |

改完不需要重启任何服务，直接重新生成：

```bash
./generate-summaries.sh
```

**只换 Key、模型不变**时缓存继续有效，已生成的摘要不会重复调用。

**换模型或换服务商时必须清缓存**，否则旧摘要会被判定为有效而跳过：

```bash
rm -f .cache/summaries-cache.json
./generate-summaries.sh
```

想强制全部重新生成，加 `--force`：

```bash
./generate-summaries.sh --force
```

生成后构建发布：

```bash
./build.sh
```

验证新 Key 是否可用：

```bash
cd /vol1/www/astro-koharu
. ./.env.summary
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $SUMMARY_API_KEY" \
  "${SUMMARY_API_BASE_URL}models"
```

返回 `200` 说明 Key 有效，`401` 表示无效或额度不足。

换服务商时参考下表填写：

| 服务 | `SUMMARY_API_BASE_URL` | 常用模型 |
| :--- | :--- | :--- |
| DeepSeek | `https://api.deepseek.com/v1/` | `deepseek-flash`、`deepseek-v4-pro` |
| 硅基流动 | `https://api.siliconflow.cn/v1/` | `Qwen/Qwen2.5-7B-Instruct` |
| 智谱 | `https://open.bigmodel.cn/api/paas/v4/` | `glm-4-flash` |
| 本地 Ollama | `http://127.0.0.1:11434/v1/` | `qwen2.5:1.5b` |
| OpenAI | `https://api.openai.com/v1/` | `gpt-4o-mini` |

`.env.summary` 权限为 `600`，且已写入 `.git/info/exclude`，不会随 git 操作丢失或被提交。

### 构建发布

```bash
cd /vol1/www/astro-koharu
./build.sh
```

约 2–3 分钟（图片缓存命中时），首次或图片变动约 7–8 分钟。构建完成后 8080 立即更新，不需要重启 Caddy。

## 四、升级与补丁

### 升级上游版本

```bash
cd /vol1/www/astro-koharu
./update.sh
```

流程：暂存本地改动 → 拉上游 → 恢复改动 → 重打补丁 → 装依赖 → 构建。

### 重新应用本地补丁

```bash
cd /vol1/www/astro-koharu
./reapply-patches.sh
```

补丁清单：

1. **CMS 局域网访问** — 放行私有网段，否则局域网保存文章会 403
2. **dev 绑定 0.0.0.0** — 否则预览只监听 IPv6 回环
3. **AI 摘要读环境变量** — 否则接口地址写死为本地 LM Studio
4. **连通性检查带认证** — 否则云端 API 因 401 被误判为不可用

补丁脚本幂等，可重复执行。

## 五、目录结构

```text
/vol1/www/astro-koharu/
├── src/content/blog/     文章 Markdown（按分类分目录）
├── config/site.yaml      站点配置（标题、导航、评论、SEO…）
├── config/i18n-content.yaml  多语言文案
├── src/assets/summaries.json  AI 摘要数据
├── dist/                 构建产物（Caddy 直接读取）
├── .env.summary          AI 接口配置（git 忽略）
├── build.sh              构建发布
├── update.sh             升级上游
├── stop.sh               停止服务
├── generate-summaries.sh 生成 AI 摘要
├── reapply-patches.sh    重打补丁
└── patches/apply.mjs     补丁实现
```

运行环境：Node 22.23.5（`/opt/node22`）+ pnpm 10.28.2 + Caddy 2.11.9（systemd 服务 `caddy-koharu`）。

## 六、故障排查

| 现象 | 排查方向 |
| :--- | :--- |
| 8080 打不开 | `systemctl status caddy-koharu`，检查 `dist/` 是否存在 |
| CMS 能打开但存不了 | 确认补丁 1 已应用，`/api/cms/*` 返回 403 即未生效 |
| 预览局域网打不开 | 确认补丁 2 已应用，`ss -tln \| grep 4321` 应显示 `0.0.0.0` |
| 内存吃紧 | `./stop.sh` 停掉 CMS 与预览，博客常驻仅占 13 MB |
| 构建失败 | 看 `/tmp/build*.log`，多为 Node 版本或依赖问题 |

## 七、常用检查命令

```bash
# 服务状态
systemctl status caddy-koharu --no-pager
curl -s -o /dev/null -w '%{http_code}\n' http://192.168.8.169:8080/

# 端口监听
ss -tlnp | grep -E ':(8080|4321|4322)'

# 内存
free -h

# 磁盘
df -h /vol1
```

## 八、备份与恢复

### 打包备份

```bash
cd /vol1/www
tar -czf /tmp/astro-koharu-$(date +%Y%m%d).tar.gz \
  --exclude='astro-koharu/node_modules' \
  --exclude='astro-koharu/dist' \
  --exclude='astro-koharu/.astro' \
  --exclude='astro-koharu/.cache' \
  astro-koharu
ls -lh /tmp/astro-koharu-*.tar.gz
```

源目录 6.2 GB，打包后约 **63 MB**（压缩掉可重建部分），耗时约 15 秒。

取回到本地：

```bash
scp fnOS@192.168.8.169:/tmp/astro-koharu-*.tar.gz ./
```

备份包含：源码、全部文章、图片、`.git`、`config/`、运维脚本、`patches/`、`system/`、`.env.summary`。

排除项：`node_modules`（5.8 GB）、`dist`（188 MB）、`.astro`、`.cache`，这些都能重建。

### system/ 目录

项目内 `system/` 保存**项目目录之外**的部署配置，随备份一起走：

| 文件 | 内容 |
| :--- | :--- |
| `caddy/Caddyfile` | `:8080` 静态服务配置（压缩、缓存头、404 回退） |
| `systemd/caddy-koharu.service` | 守护单元 |
| `env-info.txt` | 组件版本清单 |
| `install.sh` | 一键安装，按实际项目路径与目录属主生成配置 |
| `README.md` | 从零重建全套环境的完整命令 |

### 从备份恢复

```bash
# 1. 解压
tar -xzf astro-koharu-YYYYMMDD.tar.gz -C /vol1/www
chown -R fnOS:Users /vol1/www/astro-koharu
cd /vol1/www/astro-koharu

# 2. 依赖、补丁、构建
export PATH=/opt/node22/bin:$PATH
pnpm install --frozen-lockfile --prod=false
node patches/apply.mjs
pnpm build

# 3. 重建 Caddy 与 systemd
sudo ./system/install.sh

# 4. 自检
./verify.sh
```

### 从裸机重建

`system/README.md` 里记录了完整顺序：安装 Node 22（arm64 tar）、安装 Caddy、恢复项目、装依赖、打补丁、构建、装系统服务。

### 不在备份内的

| 项 | 大小 | 重建方式 |
| :--- | ---: | :--- |
| Node 运行时 | 197 MB | `system/README.md` 第 1 步 |
| Caddy 二进制 | 47 MB | `system/README.md` 第 2 步 |
| node_modules | 5.8 GB | `pnpm install` |
| dist | 188 MB | `pnpm build` |

### 备份注意事项

- `.env.summary` 含明文 API Key，备份包不要放网盘或公共位置
- 备份前建议先 `./verify.sh` 确认当前状态正常，避免把故障状态存成基线
- 设备上的 `/tmp/astro-koharu-*.tar.gz` 取回本地后及时删除，避免重复打包占空间

## 九、音乐歌单管理

歌单页面（`/music`）和右下角的 BGM 播放器都使用**本地音频文件**，不依赖任何在线音乐接口。

### 目录与格式

| 项 | 说明 |
| :--- | :--- |
| 存放目录 | `public/music/` |
| 支持格式 | mp3 / m4a / flac / ogg / wav / aac / opus |
| 显示歌名 | 取文件名（去掉扩展名），改名即改显示名 |
| 排序 | 按文件名中文排序 |

### 添加歌曲

```bash
# 1. 上传（也可以用 fnOS 文件管理器拖拽）
scp "C:\Music\*.mp3" fnOS@192.168.8.169:/vol1/www/astro-koharu/public/music/

# 2. 同步生成歌单页与 BGM 配置
cd /vol1/www/astro-koharu
./sync-music.sh

# 3. 发布
./build.sh
```

`sync-music.sh` 会同时改写两个地方：

- `src/pages/music.md` —— 歌单页
- `config/site.yaml` 的 `bgm.audio` 段 —— 全局播放器

两条命令即可，不需要手动编辑 YAML。

### 无损格式转换

flac 体积大（实测一首 96kHz 的 85 MB），浏览器加载明显偏慢，建议转成 192 kbps mp3：

```bash
ffmpeg -y -i "input.flac" -vn -ar 44100 -codec:a libmp3lame -b:a 192k "output.mp3"
```

其中 `-vn` 用于跳过内嵌封面图——带封面的 flac 不加这个参数，ffmpeg 容易卡住不退出。

实测：85 MB flac → 5.4 MB mp3，4 首合计 129 MB → 23 MB。

### 为什么不接在线歌单

| 平台 | 实测结果 |
| :--- | :--- |
| QQ 音乐 | meting 接口返回 `upstream url empty`，拿不到音频流（版权限制） |
| 网易云 | 公共 meting 的 `type=url` 已失效；官方外链只对免费歌返回真实地址，VIP 歌 302 到 `/404` |
| 自建 meting | 常见镜像只有 amd64，本机 arm64 报 `exec format error` |

本地文件没有版权限制、不依赖网络，是个人博客最稳的方案。

### 升级时的保护

音乐相关的改动分三层保护，`./update.sh` 升级后不需要手工重配：

| 内容 | 保护方式 |
| :--- | :--- |
| `meting.ts` 的直链支持 | `patches/apply.mjs` 补丁 6，升级自动重打 |
| `music.md` 与 `bgm.audio` | 由 `sync-music.sh` 生成，`update.sh` 第 7 步自动重建 |
| `public/music/` 音频文件 | 已加入 `.git/info/exclude`，`git pull` 不会碰 |

升级流程里第 2 步会主动丢弃 `music.md` 和 `site.yaml` 的本地改动（避免 pull 冲突），第 7 步再用 `sync-music.sh` 重建。所以这两个文件不需要手动备份。

如果升级后歌单异常，手动补一次即可：

```bash
./sync-music.sh && ./build.sh
```

## 十、个性化配置

站点的标题、作者、副标题等**不要直接改** `config/site.yaml`，改为修改 `config/personal.yaml`，再用脚本写回。

### 为什么

`site.yaml` 是上游跟踪的文件，每次 `./update.sh` 升级时会被丢弃重建（否则 pull 会因本地改动而失败）。直接改它，升级后就丢了。

`config/personal.yaml` 是本地的权威来源，已加入 `.git/info/exclude`，升级不受影响。`update.sh` 第 7 步会用 `sync.sh` 把它写回 `site.yaml`。

### 修改流程

```bash
cd /vol1/www/astro-koharu
vi config/personal.yaml     # 改完保存
./sync.sh                   # 写回 site.yaml
./build.sh                  # 发布
```

`sync.sh` 只替换字段的值，保留 `site.yaml` 的行尾注释和字段顺序。

### 可配置字段

| 字段 | 说明 |
| :--- | :--- |
| `title` | 网站名称 |
| `alternate` | 网站英文名（页脚、Logo、@ handle） |
| `subtitle` | 网站副标题 |
| `name` | 作者名称 |
| `description` | 网站描述 |
| `avatar` | 网站头像路径 |
| `showLogo` | 是否显示图形 Logo |
| `author` | 作者名（文章页、SEO 用） |
| `url` | 站点完整 URL（RSS、SEO 用） |
| `defaultOgImage` | 默认社交分享图 |
| `startYear` | 建站年份（页脚版权区间） |
| `timezone` | 时区（IANA 格式） |
| `keywords` | 全局 SEO 关键词列表 |

### 改完如何确认

```bash
grep '^  title:' config/site.yaml
curl -s http://192.168.8.169:8080/ | grep -o '<title>[^<]*</title>'
```

第一条看 `site.yaml` 是否已同步，第二条确认构建后的页面标题。

### 与升级的关系

`./update.sh` 的流程保证了配置不会丢：

1. **第 2 步**：丢弃 `site.yaml`（连同所有本地改动），避免 pull 冲突
2. **第 3 步**：拉取上游最新代码
3. **第 7 步**：执行 `./sync.sh`，用 `personal.yaml` 重建站点配置、用 `public/music/` 重建歌单
4. **第 9 步**：`./verify.sh` 自检 12 项

所以升级后配置会自动回来，不需要手工对比 `/tmp` 里的备份。

### 如果要加新的个性化项

比如导航、社交链接、评论配置这些也在 `site.yaml` 里，但目前不在 `personal.yaml` 的覆盖范围内。

需要长期保留的改动，两种做法：

1. 加进 `scripts/sync-config.mjs`（适合标量字段，脚本会按段替换）
2. 写成 `patches/apply.mjs` 里的补丁（适合复杂结构）

临时改动可以先直接改 `site.yaml`，但记得升级前备份：`cp config/site.yaml /tmp/site.yaml.bak`。

### system/ 与 config/ 的分工

| 目录 | 内容 | 升级影响 |
| :--- | :--- | :--- |
| `config/personal.yaml` | 站点名称、作者、URL 等 | 不受影响（git 忽略） |
| `config/site.yaml` | 完整站点配置 | 会被丢弃重建 |
| `system/` | Caddy、systemd 配置 | 不受影响（git 忽略） |

## 十一、追番页面

追番页（`/bangumi`）从 Bangumi.tv **实时拉取**你的收藏，不需要手工维护数据。

### 配置

只需要一个 bgm.tv 用户名（或数字 ID）：

```yaml
# config/personal.yaml
bangumi:
  userId: x24moe
```

然后：

```bash
cd /vol1/www/astro-koharu
./sync.sh      # 写入 site.yaml
./build.sh     # 发布
```

**怎么找 userId**：登录 bgm.tv，打开自己的个人主页，地址栏 `https://bgm.tv/user/xxxxx` 里的 `xxxxx` 就是用户名。数字 ID 在「设置 → 个人资料」里也能看到。

### 数据来源

| 项 | 说明 |
| :--- | :--- |
| 接口 | `https://api.bgm.tv/v0/users/{userId}/collections` |
| 认证 | 不需要 token，公开收藏直接可读 |
| 请求方 | **浏览器端**（`client:load`），不经过本站服务器 |
| 分页 | 每页 50 条，最多 20 页（上限 1000 条） |
| 抓取类型 | 动画、书籍、音乐、游戏、三次元（有数据才显示对应 tab） |
| 封面 | `lain.bgm.tv` |

因为没有服务端参与，API 的速率限制和可用性直接由你的浏览器承受，本站不产生流量。

### bgm.tv 更新后如何生效

**不需要重新构建，也不需要重启服务。**

数据是每次打开页面时实时请求的：

1. 在 bgm.tv 把某部番标记为「看过 / 在看 / 想看」
2. 回到博客打开 `/bangumi/`，或直接刷新页面
3. 新数据立即出现

如果没变化，按 `Ctrl + F5` 强制刷新，绕过浏览器缓存。

已确认组件没有任何客户端缓存：`useBangumiData` 的 `useEffect` 依赖 `[userId, trigger]`，每次挂载都会重新拉取全部类型；也没有使用 `localStorage` 或 `sessionStorage`。API 响应头为 `cf-cache-status: BYPASS`，Cloudflare 不缓存。

### 什么时候才需要重新构建

只有改了**配置**才需要：

| 改动 | 需要的操作 |
| :--- | :--- |
| 追番内容变化（标记新番） | 无需操作，刷新即可 |
| 换 `userId` | `./sync.sh && ./build.sh` |
| 改导航显示名或图标 | 同上 |
| 主题升级 | `./update.sh` 自动处理（`personal.yaml` 会重建配置） |

### 可选的显示项

`site.yaml` 的 `bangumi` 段还支持两个字段，默认被注释：

```yaml
bangumi:
  userId: x24moe
  label: 追番              # 导航显示名称
  icon: ri:bilibili-fill   # Iconify 图标
```

要启用就在 `personal.yaml` 里一起写上，`sync.sh` 会一并写入。注意 `site.yaml` 里这两行原本是注释状态，同步脚本只替换已存在的字段，不会自动解除注释——需要手动去掉 `#` 后再跑 sync。

### 关闭追番页面

代码里 `bangumi.astro` 有 `if (!bangumiConfig) return Astro.redirect('/404')`，所以只要 `site.yaml` 里没有 `bangumi` 段，页面和导航就会自动隐藏。

**长期关闭的完整做法**（否则升级后会被 `personal.yaml` 重新写回）：

1. 从 `config/personal.yaml` 删掉 `bangumi:` 段
2. 编辑 `config/site.yaml`，注释掉整个 `bangumi:` 段
3. `./build.sh`

### 数据不显示怎么排查

```bash
# 1. 账号是否存在
curl -s "https://api.bgm.tv/v0/users/x24moe" | head -c 120

# 2. 是否有收藏数据
curl -s "https://api.bgm.tv/v0/users/x24moe/collections?subject_type=2&limit=1" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log('total:',j.total)})"

# 3. 构建产物里是否注入了 userId
curl -s http://192.168.8.169:8080/bangumi/ | grep -o 'x24moe' | head -1
```

三条都正常但页面仍空白，打开浏览器控制台看是否有 CORS 或网络错误。API 的 CORS 是 `allow-origin: *`，正常情况下不会被拦截。

### 一个已知限制

页面会同时请求 5 种类型（动画/书籍/音乐/游戏/三次元），每种最多 20 页。如果你的收藏非常多（单类型超过 1000 条），超出部分不会显示。

## 十二、关于页与友链

这两个页面的内容不在 `site.yaml` 的 `site` 段里，但同样是 git 跟踪文件，升级时会被丢弃。现在改为由本地文件生成。

### 关于页

**改这里**：`content-custom/about.md`

```bash
cd /vol1/www/astro-koharu
nano content-custom/about.md
./sync.sh      # 复制到 src/pages/about.md
./build.sh
```

文件结构：

```yaml
---
layout: ../layouts/PageLayout.astro
title: "About"
coverTitle: "关于我"      # 页面顶部大字
date: 2025-01-03 01:01:33
description: "关于我？"
---

## 正文标题

正文用普通 Markdown，可以写标题、图片、徽章、引用。
```

frontmatter 的 `coverTitle` 是页面顶部显示的大字标题，`title` 是浏览器标签页标题。

### 友链

**改这里**：`config/friends.yaml`

```bash
nano config/friends.yaml
./sync.sh      # 整段写回 site.yaml
./build.sh
```

结构分三块：

```yaml
friends:
  groups:      # ① 分组定义
    - id: familiar
      title: 熟人
      description: 常有交流、彼此熟悉的朋友。

  intro:       # ② 页面文案
    title: 友情链接
    subtitle: 欢迎交换友链！
    applyTitle: 申请友链
    applyDesc: 请在本页留言，格式如下
    exampleYaml: |
      - site: 你的博客名称
        url: https://your-blog.com/

  data:        # ③ 友链列表
    - site: 站点名称
      url: https://example.com
      owner: 昵称
      desc: 站点简介
      image: https://example.com/avatar.jpg
      color: '#ed788b'
      group: familiar
```

### 友链字段

| 字段 | 必填 | 说明 |
| :--- | :--- | :--- |
| `site` | 是 | 站点名称 |
| `url` | 是 | 站点网址 |
| `owner` | 是 | 昵称 |
| `desc` | 是 | 站点简介 |
| `image` | 是 | 头像 URL |
| `color` | 否 | 卡片主题色，如 `'#ed788b'` |
| `group` | 否 | 对应 `groups` 的 `id`，不填归入未分组 |

### 同步机制

友链是嵌套结构，逐字段替换不现实，改用**整段替换**：

```js
const re = /^friends:[\s\S]*?(?=^[a-z])/m;
text = text.replace(re, () => `${block}\n\n`);
```

匹配 `friends:` 到「下一个顶级小写键」之前的全部内容，用 `friends.yaml` 的原文替换。因为是文本替换而非重新序列化，缩进、引号、写法都能保留。

关于页更简单，直接 `copyFileSync` 覆盖。

### 升级保护

| 本地文件 | 目标 | 丢失后如何恢复 |
| :--- | :--- | :--- |
| `content-custom/about.md` | `src/pages/about.md` | `./sync.sh` |
| `config/friends.yaml` | `site.yaml` 的 `friends:` 段 | `./sync.sh` |

两个文件都在 `.git/info/exclude` 里，`git pull` 不会碰。`update.sh` 第 7 步执行 `sync.sh` 时会一起重建。

### 演练验证

把 `site.yaml` 和 `about.md` 全部 `git checkout` 回退到上游原版，再跑 `./sync.sh`：

- `site.title` 从「余弦の博客」恢复为「Aha」
- `site.author` 从「Author」恢复为「x24moe」
- 友链 8 条 3 组、bangumi、bgm 全部回来
- YAML 结构完好（navigation 7 条、friends 8 条）

### 新增其他定制页面

如果以后还有页面需要长期定制（留言板、项目页等），照同样模式：

1. 内容放到 `content-custom/` 或 `config/`
2. 在 `scripts/sync-config.mjs` 加一段同步逻辑
3. 加入 `.git/info/exclude`

`sync.sh` 目前同步 16 项：site 段 13 字段 + bangumi + friends 段 + about.md + 音乐歌单。
