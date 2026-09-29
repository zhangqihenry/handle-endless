# handle-endless 1.0.0 Docker 部署指南

本项目可通过通用 Docker Compose 环境部署，不依赖群晖专有功能。适用场景包括 Linux 服务器、Docker Desktop 和支持 Docker 的 NAS。群晖的图形界面操作见[群晖部署指南](SYNOLOGY.md)。

## 环境要求

- Docker Engine 与 Compose 插件，或自带 Compose 的 Docker Desktop。
- 支持运行 Linux 容器；Windows 上的 Docker Desktop 需使用 Linux 容器模式。
- CPU 架构受所用 `node:22-alpine` 镜像支持，详见 [Node.js 官方镜像说明](https://github.com/nodejs/docker-node)。
- 部署目录可以挂载到容器，`data` 目录允许容器写入；端口 13863 可用。
- 首次启动可联网拉取运行镜像。ZIP 不含离线镜像。

[Docker Compose 安装说明](https://docs.docker.com/compose/install/)提供各平台的安装入口。

## 下载与启动

从 [Releases](https://github.com/zhangqihenry/handle-endless/releases/latest) 下载 `Handle_Endless-1.0.0-docker.zip`，完整解压，保持以下目录结构：

```text
Handle_Endless-1.0.0-docker/
  compose.yaml
  .env.example
  www/
  server/
  data/
  README.md
  SYNOLOGY.md
  EXTRA_IDIOMS.md
```

在该目录中运行：

```sh
docker compose up -d
docker compose ps
```

| 页面 | 地址 |
| --- | --- |
| 游戏 | `http://服务器IP:13863/` |
| 词库管理 | `http://服务器IP:13863/admin` |

在本机部署时可使用 `localhost`。默认管理密码是 `handleendlessadmin123`，管理页面支持修改密码。安装包已经包含网页和服务端程序，宿主机无需安装 Node.js 或前端构建工具。

GitHub 自动生成的 Source code 压缩包是源代码，不包含预编译安装目录。直接部署请选择带 `docker.zip` 的附件。

## 端口和配置

默认宿主机端口为 13863。需要调整时，复制 `.env.example` 为 `.env`，修改 `HANDLE_PORT`：

```dotenv
HANDLE_PORT=13863
COOKIE_SECURE=false
```

然后重新创建容器：

```sh
docker compose up -d --force-recreate
```

容器内部端口保持 13863，浏览器使用 `HANDLE_PORT` 对应的宿主机端口。只有网站已通过 HTTPS 访问时，才将 `COOKIE_SECURE` 设置为 `true`；局域网 HTTP 访问保持 `false`。

## 数据与管理

| 位置 | 内容 |
| --- | --- |
| `data/library-state.json` | 普通库修改记录和扩展库 |
| `data/admin-auth.json` | 管理密码的加盐哈希记录 |
| 玩家浏览器 | 答题进度和个人设置 |

备份时保存整个 `data` 目录。该目录通过挂载保留，重建容器不会自动清空其中的数据。不要将管理员密码记录发布到代码仓库。

词库修改在玩家刷新游戏后生效，已打开的题目保持原有答案。管理会话最长 8 小时，后台重启或密码修改后需要重新登录。词库维护规则见[词库管理说明](EXTRA_IDIOMS.md)。

需要重置管理密码时，先停止容器，将 `data/admin-auth.json` 重命名备份后再启动；后台会重新初始化默认密码。

## 升级与迁移

1. 备份整个 `data` 目录，运行 `docker compose down` 停止旧项目。
2. 解压新安装包，用新的 `www`、`server` 和 `compose.yaml` 替换程序文件，保留已有 `data` 和自定义 `.env`。
3. 运行 `docker compose up -d --force-recreate`，确认服务正常。

不要用新包中的空 `data` 目录覆盖已有数据。继续使用原来的域名和端口，可保留该地址下的浏览器答题记录；更换地址后进度不会自动迁移。

从 v0.2.0 升级时，后台首次启动会将旧 `data/extra-idioms.json` 导入 `data/library-state.json`，旧文件留作备份。导入完成后，词库修改以新文件为准。

从 v0.1.0 升级时，同样保留旧扩展库文件并迁移；旧 `nginx.conf` 不再使用。v0.1.0 与后续版本的随机候选范围不同，旧随机分享链接可能提示词库版本不匹配。

## 反向代理

使用独立域名或根路径代理，转发到宿主机的 13863 端口，并保留请求的 Host，例如 Nginx 的 `proxy_set_header Host $http_host;`。

启用 HTTPS 后，可设置 `COOKIE_SECURE=true`，再重新创建容器，让管理 Cookie 仅通过 HTTPS 发送。

## 常用命令

```sh
# 查看状态
docker compose ps

# 查看最近日志
docker compose logs --tail=100

# 停止服务
docker compose down

# 重新创建容器
docker compose up -d --force-recreate
```

如果后台提示数据目录无法写入，请检查宿主机目录权限和 Docker 文件共享设置。处理器架构不受运行镜像支持时，不能直接使用该镜像部署。

## 验证范围

已验证网页、真实 HTTP 后台和安装包内服务启动。开发机没有 Docker，尚未进行容器或 NAS 实机验证；平台适用性以满足上述运行条件为前提。
