---
title: 周刊 Vol.1：把博客从 Docker 搬回裸机
link: weekly-vol-1
catalog: true
date: 2026-11-04 21:00:00
tags:
  - 周刊
  - 部署
categories:
  - 周刊
keywords:
  - 周刊
  - Docker
  - 部署
---

这是周刊的第一期，记录本周把博客部署从 Docker Compose 换回主机直装的过程与判断依据。

## 起因

原本用四个容器（CMS、预览、静态站、构建器）编排，能跑，但每次改一行配置都要面对镜像层、命名卷、Compose 的 `profiles` 这些额外概念。更麻烦的是一次批量清理把容器和镜像一起删了，恢复要重建 1.75 GB 镜像。

## 判断

这台设备是 4 核 Cortex-A55 加 3.7 GB 内存，Docker 的隔离收益几乎为零，而更新成本很高：依赖变化就要重建镜像，实测 14 分 51 秒。换成主机直装后，同样是装依赖，`pnpm install` 只要 4 分 29 秒，而且没有镜像层这一层抽象。

## 结果

现在架构是 Node 运行时加一个 Caddy 静态服务器，Caddy 常驻只占 13 MB 内存。故障面从「Docker daemon + 镜像层 + Compose 编排 + 容器被误删」缩减到「Node 进程 + 一个反向代理」。

## 一点体会

工具带来的便利是有成本的，成本通常体现为「出问题时要多理解一层」。对单机个人服务来说，把这一层去掉往往更划算。

```bash
# 现在的发布流程
cd /vol1/www/astro-koharu
./build.sh
```
