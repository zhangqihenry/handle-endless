# handle-endless 1.1.0 群晖部署指南

群晖是本项目支持的部署场景之一。项目使用通用 Docker Compose 配置，也适用于满足运行条件的服务器、电脑和其他 NAS，详见 [Docker 部署指南](DOCKER.md)。

## Container Manager 安装

1. 确认群晖机型支持 Container Manager 或 Docker 套件，处理器架构受 `node:22-alpine` 镜像支持。
2. 从 [Releases](https://github.com/zhangqihenry/handle-endless/releases/latest) 下载 Docker ZIP，完整解压到例如 `/volume1/docker/Handle_Endless-1.1.0-docker/`。保留 `www`、`server`、`data` 和 `compose.yaml` 的相对位置。
3. 打开 Container Manager → 项目 → 新增，项目名称填写 `handle-endless`，路径选择解压目录，使用已有的 `compose.yaml` 创建并启动。
4. 访问游戏：`http://群晖局域网IP:13863/`。
5. 访问词库管理：`http://群晖局域网IP:13863/admin`。默认密码为 `handleendlessadmin123`，可在管理页修改。

首次启动需要联网拉取运行镜像，NAS 无需安装 Node.js 或编译项目。旧版 Docker 套件可在安装 Compose 后通过命令行部署。

## 端口、数据与升级

默认端口为 13863。如端口被占用，复制 `.env.example` 为 `.env`，修改 `HANDLE_PORT` 后重新部署。

词库和管理员密码记录保存在项目的 `data` 目录。升级前先备份并保留整个目录，替换程序文件后重新创建容器。请勿用新包的空数据覆盖旧数据。

答题进度和个人设置保存在浏览器中；更换域名、端口或浏览器后，旧进度不会自动迁移。

详细配置、旧版数据迁移、密码重置、HTTPS 反向代理和维护命令统一见 [Docker 部署指南](DOCKER.md)。词库使用方法见[词库管理说明](EXTRA_IDIOMS.md)。

当前已验证应用和安装包内服务，尚未进行群晖实机验证。
