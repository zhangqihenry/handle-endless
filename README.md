# 汉兜无限 handle-endless

> 支持每日同题、历史回顾和种子随机挑战的自托管成语猜词游戏。

汉兜无限基于 [antfu/handle](https://github.com/antfu/handle) 开发，保留原版的成语与拼音猜词玩法，增加历史日历、种子随机题和词库管理功能。

项目支持通过 **Docker Compose** 部署，可用于 Linux 服务器、运行 Docker Desktop 的电脑，以及支持 Docker 的 NAS。

**[下载最新版本](https://github.com/zhangqihenry/handle-endless/releases/latest)** · **[Docker 部署指南](docs/DOCKER.md)** · **[群晖部署指南](docs/SYNOLOGY.md)** · **[词库管理说明](docs/EXTRA_IDIOMS.md)**

## 主要功能

- **每日同题**：沿用官方答案表和选题规则，同一公历日期的答案与原版保持一致，按北京时间 UTC+8 换日。兼容性细节见[说明](UPSTREAM.md)。
- **历史日历**：选择 2022 年 1 月 1 日至今天之间的日期，回顾过去的题目。
- **种子随机挑战**：输入数字种子，在相同词库版本下得到相同题目，方便与朋友一起挑战。
- **词库管理**：密码保护的管理页面支持查看每日库、维护普通成语库和扩展库，并自动检查重复。
- **逐词选择随机候选**：普通库中的成语可勾选加入扩展库，取消勾选即可移除；与每日库重合的词会明确标注。
- **独立进度与分享**：不同日期和随机题目分别保存进度，分享文本与图片明确标注日期或种子。
- **默认严格挑战**：默认开启“禁用提示”和“严格模式”，玩家可自行调整。

## Docker Compose 快速部署

### 环境要求

- 已安装 Docker Engine 和 Compose 插件，或已安装 Docker Desktop。
- 能够运行 Linux 容器，设备架构受 `node:22-alpine` 镜像支持。
- 首次启动能够拉取镜像，部署目录允许容器读写 `data` 文件夹。

Docker Desktop 支持 Windows、macOS 和 Linux，详见 [Docker Compose 安装说明](https://docs.docker.com/compose/install/)。Windows 环境需使用 Linux 容器模式。

### 安装与启动

1. 从 [Releases](https://github.com/zhangqihenry/handle-endless/releases/latest) 下载 `Handle_Endless-1.0.0-docker.zip` 并完整解压。请选择带 `docker.zip` 的安装包；GitHub 自动生成的 Source code 压缩包为源代码。
2. 在解压后的目录中打开终端，执行：

   ```sh
   docker compose up -d
   docker compose ps
   ```

3. 在浏览器访问服务：

   | 页面 | 地址 |
   | --- | --- |
   | 游戏 | `http://服务器IP:13863/` |
   | 词库管理 | `http://服务器IP:13863/admin` |

在本机部署时，将服务器 IP 换为 `localhost`。

默认管理密码为 `handleendlessadmin123`，可以在管理页面修改。

安装包包含预编译网页和服务端程序，无需在部署设备上安装 Node.js、pnpm 或编译项目。ZIP 不含离线 Docker 镜像，首次启动会拉取 `node:22-alpine`。

完整的端口配置、升级、备份和反向代理说明见 [Docker 部署指南](docs/DOCKER.md)。群晖用户也可以通过 [Container Manager](docs/SYNOLOGY.md) 创建项目。

## 词库与随机题目

| 词库 | 用途 | 管理方式 |
| --- | --- | --- |
| 官方每日库 | 每日题目、历史题目和随机候选 | 只读，保留官方答案表 |
| 官方普通成语库 | 严格模式输入校验及拼音处理 | 可新增、编辑、删除 |
| 扩展库 | 增加随机候选，并允许输入新增词语 | 可新增、编辑、删除，也可从普通库勾选加入 |

随机题目从**官方每日库与扩展库的合集**中抽取，普通库不会整体进入随机候选。每日库已收录的词不能重复加入扩展库。

维护普通库和扩展库不会改变每日答案。每日库重合词在游戏中保留官方读音，以确保每日题目的兼容性。

相同种子需要配合相同词库版本使用。扩展库增删词条或修改读音后，种子对应的题目可能变化；分享链接携带词库版本，版本不一致时会明确提示。

详细规则见[词库管理说明](docs/EXTRA_IDIOMS.md)。

## 数据保存与升级

词库修改和管理员密码记录保存在部署目录的 `data` 文件夹中。**升级前请备份并保留整个 `data` 目录，不要用安装包中的空目录覆盖已有数据。**

答题进度和个人设置保存在浏览器中。更换浏览器、域名或端口后，旧地址的进度不会自动迁移。

## 本地开发

开发环境使用 Node.js 22、pnpm 7.33.7；生成 ZIP 另需 Python 3。

```sh
git clone https://github.com/zhangqihenry/handle-endless.git
cd handle-endless
npx pnpm@7.33.7 install --frozen-lockfile --ignore-scripts
npx pnpm@7.33.7 build
npx pnpm@7.33.7 start
```

访问 `http://localhost:13863/`。开发前端时保持后台运行，在另一个终端执行 `npx pnpm@7.33.7 dev`，然后访问 `http://localhost:13864/`。

```sh
npx pnpm@7.33.7 test:run
npx pnpm@7.33.7 package:docker
```

仓库同时提供 `Dockerfile`，支持从源码构建镜像。发布安装包采用预编译文件，可直接通过 Docker Compose 启动。

## 兼容性与验证

项目使用通用 Docker Compose 配置，不依赖特定 NAS 品牌。实际部署需要满足容器类型、镜像架构、目录权限和网络条件。

当前版本已通过应用测试、生产构建和安装包内服务的启动验证，尚未进行 Docker 容器或 NAS 实机验证。详见[验证记录](docs/VALIDATION.md)。

## 致谢

本项目 fork 自 [antfu/handle](https://github.com/antfu/handle)，保留上游提交历史与许可证。玩法灵感来自 Wordle。

## License

[MIT](LICENSE)。保留上游版权声明。
