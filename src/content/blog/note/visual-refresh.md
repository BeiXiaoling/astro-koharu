---
title: 给站点换一套视觉：图标、头像、封面与顶图
link: visual-refresh
catalog: true
date: 2026-11-19 17:00:00
cover: /img/cover-custom/05.webp
tags:
  - 教程
  - 设计
  - 运维
  - 图片处理
categories:
  - 笔记
---

站点跑起来之后，视觉上还是主题默认的那一套：别人的图标、别人的头像、别人拍的封面。这篇记录把它们全部换成自己的，顺便把替换流程做成可重复执行的脚本。

## 一、先搞清楚要改什么

一个博客的视觉资源大致分四类：

| 类型 | 文件 | 原始规格 |
| :--- | :--- | :--- |
| 浏览器图标 | `public/favicon.ico` | 4.2 KB 单尺寸 |
| 作者头像 | `public/img/avatar.webp` | 320×320 |
| 文章默认封面 | `public/img/cover/1~21.webp` | 800×450，21 张内置 |
| 顶部大图 | `public/img/site_header_*.webp` | 4 档，最大 1928×1080 |

主题的主色是 `--primary: 351 77% 62%`，换算过来是玫瑰粉（约 `#E8546B`）。选图时以这个为锚点，蓝色、粉色、紫色系都能融进去。

## 二、浏览器图标

源图是一张 72×72 的透明 PNG。72 作为标签页图标够用，但 iOS 添加到主屏需要 180×180。

生成三个文件：

```python
from PIL import Image

fav = Image.open('icon.png').convert('RGBA')

# 多尺寸 ICO
fav.save('favicon.ico', format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64)])
# iOS 主屏
fav.resize((180,180), Image.LANCZOS).save('apple-touch-icon.png')
# Android / 通用
fav.resize((192,192), Image.LANCZOS).save('icon-192.png')
```

顺手发现主题的一个小 bug：`HeadMeta.astro` 里写着

```astro
<link rel="icon" type="image/svg+xml" href="/favicon.ico" />
```

声明成 SVG 但文件是 ICO。浏览器容错能力强，不影响显示，但不规范。改成三行：

```astro
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
```

这条改动做成了补丁，升级后自动重打。

## 三、作者头像

源图 640×640，主题显示尺寸是 320，直接缩一半：

```python
img = Image.open('avatar.jpg').convert('RGB')
img.resize((320,320), Image.LANCZOS).save('avatar.webp', 'WEBP', quality=88)
```

17 KB → 7.6 KB，画质看不出差别。

头像同时被用作 `og:image`（社交分享图），所以深色背景反而容易在白底信息流里跳出来。

## 四、默认封面池

主题内置 21 张示例封面。要换成自己的，先解决「从几百张图里挑合适的」这个问题。

手头两个图库共 940 张。逐张看显然不现实，写脚本筛：

**第一步：读尺寸。** 用 `file` 命令读 JPEG 尺寸不可靠——它经常返回 1×1（读到的是缩略图段）。改为直接解析 JPEG 的 SOF 段：

```python
def jpeg_size(p):
    with open(p, 'rb') as f:
        if f.read(2) != b'\xff\xd8':
            return None
        while True:
            b = f.read(1)
            if not b: return None
            if b != b'\xff': continue
            m = f.read(1)
            while m == b'\xff': m = f.read(1)
            ln = struct.unpack('>H', f.read(2))[0]
            # SOF0-SOF15（排除 C4/C8/CC）里含宽高
            if 0xc0 <= m[0] <= 0xcf and m[0] not in (0xc4, 0xc8, 0xcc):
                f.read(1)
                h, w = struct.unpack('>HH', f.read(4))
                return w, h
            f.seek(ln - 2, 1)
```

**第二步：卡条件。**

```plain
940 张 → 863 可解析（排除 gif/heif）
      → 125 张宽≥1200 且比例 1.3-2.4
      → 35 张宽≥2000 且比例 1.70-1.86（近 16:9）
```

**第三步：肉眼筛。** 随机抽 12 张拼成联系表，一次看完：

```bash
ffmpeg -y -i a.jpg -vf 'scale=400:225:force_original_aspect_ratio=increase,crop=400:225' thumb_0.jpg
# ... 批量生成后 xstack 拼接
ffmpeg -i thumb_0.jpg -i thumb_1.jpg ... \
  -filter_complex "[0:v][1:v]...[11:v]xstack=inputs=12:layout=0_0|400_0|800_0|..." sheet.jpg
```

联系表里排除掉两张：一张深蓝近全黑（作为封面太重），一张密集人物群像（缩略图下完全糊成一片）。

**第四步：裁成封面尺寸。**

```bash
ffmpeg -i src.jpg -vf 'scale=800:450:force_original_aspect_ratio=increase,crop=800:450' \
  -c:v libwebp -quality 82 out.webp
```

`force_original_aspect_ratio=increase` 先等比放大到覆盖目标尺寸，再居中裁切。10 张成品共 1.2 MB，单张 54–136 KB。

最后写进配置：

```yaml
# config/personal.yaml
defaultCoverList:
  - /img/cover-custom/01.webp
  # ...
  - /img/cover-custom/10.webp
```

文章没写 `cover` 字段时，从这里随机取一张。

## 五、顶部大图

顶图有 4 个尺寸档，比例都是 **1.786:1**（不是标准 16:9 的 1.778，略高一点）：

| 文件 | 像素 |
| :--- | :--- |
| `site_header_800.webp` | 800×448 |
| `site_header_1200.webp` | 1200×672 |
| `site_header_1600.webp` | 1600×896 |
| `site_header_1920.webp` | 1928×1080 |

注意最后一个是「文件名 1920、实际 1928」，改的时候别搞混。

源图 5120×2880，按 1.786 比例裁切生成四档：

```bash
for wh in 800x448 1200x672 1600x896 1928x1080; do
  w=${wh%x*}; h=${wh#*x}
  ffmpeg -i hero.jpg -vf "scale=$w:$h:force_original_aspect_ratio=increase,crop=$w:$h" \
    -c:v libwebp -quality 82 site_header_$w.webp
done
```

### 一个容易忽略的约束

主题对竖屏手机做了特殊处理：

```ts
export const portraitHeroMedia = '(max-width: 440px) and (max-aspect-ratio: 8/15)';
export const portraitHeroTransform = {
  width: 400, height: 450,   // 接近方形
  fit: 'cover', position: 'centre',
};
```

手机上不显示整张横图，而是取**画面正中央的 400×450**。

所以选图标准不只是「横图好看」，还要「正中央那块单独看也成立」。人物站在侧边的图会在这里翻车——竖屏只剩半个身子。

最终选的这张樱花街道：路在正中、两侧是树和房子，横图有纵深，竖屏裁中间也还有路和天空。

## 六、统一管理：让它们跟着升级活下来

这四类资源全是 git 跟踪文件，`./update.sh` 升级时会被丢弃。解决办法和之前的配置、音乐一样：**本地文件做来源，脚本写回**。

目录结构：

```text
content-custom/assets/
├── icons/
│   ├── favicon.ico
│   ├── apple-touch-icon.png
│   └── icon-192.png
├── avatar.webp
├── hero/
│   ├── site_header_800.webp
│   ├── site_header_1200.webp
│   ├── site_header_1600.webp
│   └── site_header_1920.webp
└── covers/
    └── 01.webp ... 10.webp
```

`scripts/sync-assets.mjs` 负责复制到 `public/`：

```js
const FILES = [
  ['icons/favicon.ico', 'public/favicon.ico'],
  ['icons/apple-touch-icon.png', 'public/apple-touch-icon.png'],
  ['icons/icon-192.png', 'public/icon-192.png'],
  ['avatar.webp', 'public/img/avatar.webp'],
];

for (const [src, dst] of FILES) {
  if (fs.existsSync(path.join(ROOT, src))) {
    fs.copyFileSync(path.join(ROOT, src), dst);
  }
}
```

`hero/` 和 `covers/` 两个目录整体拷贝。

现在 `./sync.sh` 分三步执行：

```text
→ 同步站点配置 ...     （17 项：site 段、bangumi、friends、about、defaultCoverList）
→ 同步视觉资源 ...     （18 个文件：3 图标 + 1 头像 + 4 顶图 + 10 封面）
→ 同步音乐歌单 ...     （music.md + bgm.audio）
```

`content-custom/` 整个目录在 `.git/info/exclude` 里，`git pull` 不会碰。

## 七、踩过的坑

| 问题 | 原因 | 处理 |
| :--- | :--- | :--- |
| `file` 报 JPEG 尺寸为 1×1 | 读到的是 EXIF 缩略图段 | 手写 SOF 段解析 |
| ffmpeg 批量转图后后续命令报错 | ffmpeg 读走了 stdin | 加 `-nostdin` |
| 顶图 1928 档没生效 | 文件名叫 `site_header_1920.webp`，实际 1928px | 按文件名而非像素命名 |
| `sync-config.mjs` 报 `personal is not defined` | 变量声明在 `if` 块内 | 提升到顶层作用域 |
| webp 头解析出 2107906×115204 | 把 VP8X 的偏移量用错了 | 改用 ffprobe 读 |

## 八、结果

- 标签页图标：透明背景，深色/浅色主题下都清晰
- 头像：320×320 webp，7.6 KB
- 默认封面：10 张 800×450，共 1.2 MB
- 顶图：4 档，最大 1928×1080
- 所有资源可一键重建，升级零成本

视觉定制看起来是「换几张图」的事，实际上一半工作量在「怎么批量挑图」和「怎么让它们不被升级冲掉」。前一半靠脚本，后一半靠约定。
