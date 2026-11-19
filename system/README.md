# system/ — 系统级配置备份

本目录保存项目目录之外的部署配置，便于换机或重建。

```text
system/
├── caddy/Caddyfile                   Caddy 静态服务配置（:8080）
├── systemd/caddy-koharu.service      systemd 守护单元
├── env-info.txt                      运行环境版本清单
├── install.sh                        一键安装上述配置（需 root）
└── README.md                         本文件
```

## 安装

```sh
sudo ./system/install.sh
```

脚本行为：

1. 按**实际项目路径**重写 `Caddyfile` 的 `root` 行
2. 按**实际目录属主**重写服务的 `User=` / `Group=`
3. `daemon-reload` + `enable` + `restart`
4. curl 验证 8080 返回 200

幂等，可重复执行。

## 从零重建整套环境

```sh
# 1. Node 22（arm64）
cd /tmp
curl -sL -o node.txz https://npmmirror.com/mirrors/node/v22.23.5/node-v22.23.5-linux-arm64.tar.xz
mkdir -p /opt/node22 && tar -xJf node.txz -C /opt/node22 --strip-components=1
for b in node npm npx corepack; do ln -sf /opt/node22/bin/$b /usr/local/bin/$b; done
corepack enable --install-directory /opt/node22/bin
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack prepare pnpm@10.28.2 --activate

# 2. Caddy（arm64）
cd /tmp
curl -sL -o caddy.tgz https://github.com/caddyserver/caddy/releases/download/v2.11.9/caddy_2.11.9_linux_arm64.tar.gz
tar -xzf caddy.tgz caddy && mv caddy /usr/local/bin/ && chmod +x /usr/local/bin/caddy

# 3. 项目
cd /vol1/www/astro-koharu
export PATH=/opt/node22/bin:$PATH
pnpm config set store-dir /vol1/www/.pnpm-store
pnpm install --frozen-lockfile --prod=false

# 4. 补丁与构建
node patches/apply.mjs
pnpm build

# 5. 系统服务
sudo ./system/install.sh

# 6. 自检
./verify.sh
```

## 不在本备份内的

- Caddy 二进制本身（47 MB，按上文第 2 步重下）
- Node 运行时（197 MB，按上文第 1 步重装）
- `node_modules`（5.8 GB，`pnpm install` 重建）
- `dist`（188 MB，`pnpm build` 重建）
