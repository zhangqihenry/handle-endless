# Handle_Endless v1.0.0 群晖部署

本包包含预编译网页、词库管理后台和 Compose 配置。NAS 无需安装开发工具或编译项目。首次启动需要联网拉取 `node:22-alpine` 镜像，ZIP 不含离线镜像。

## Container Manager 安装

1. 解压整个 ZIP，将 `Handle_Endless-1.0.0-docker` 文件夹放到 `/volume1/docker/` 下，保留 `www`、`server`、`data` 和 `compose.yaml`。
2. 打开 Container Manager → 项目 → 新增，名称填写 `handle-endless`，路径选择该文件夹，使用已有的 `compose.yaml` 创建并启动。
3. 游戏地址：`http://你的NAS局域网IP:13863/`。
4. 管理地址：`http://你的NAS局域网IP:13863/admin`，默认密码为 `handleendlessadmin123`。

13863 是项目固定使用的 10000 以上端口，重启后保持不变。如有冲突，复制 `.env.example` 为 `.env`，将 `HANDLE_PORT` 改为其他 10000 以上未占用的端口，然后重新部署。容器内部端口保持 13863。

## 命令行安装

进入解压目录运行：

```sh
docker compose up -d
docker compose ps
```

旧版 Docker 套件可使用 `docker-compose up -d`。NAS 需要支持 Docker 或 Container Manager，处理器需在 Node.js 官方镜像支持范围内。

## 管理与数据

- 每日库只读；普通库支持增删改，标注每日重合词，每行可勾选加入扩展库、取消移除。支持搜索；普通库每页可选 50、100、250、500 或 1000 条，选择会自动记住。每日重合词的扩展库勾选禁用。
- 扩展库可添加、编辑和删除。添加与编辑时都会检查官方每日库，重复词会被拒绝，繁体输入会按简体检查。
- 官方普通库已有的词可以加入扩展库，自动采用当前普通库读音。普通库未收录的词需人工填写读音。
- 随机题目只使用官方每日库与扩展库的合集。严格模式校验使用修改后的普通库、扩展库及保留的每日候选。每日重合词始终采用官方读音。
- 普通库修改与扩展库共同写入 `data/library-state.json`，密码的加盐哈希保存在 `data/admin-auth.json`。重建容器不影响这些文件，升级时务必保留整个 `data` 目录。
- 管理页下方可以修改密码。修改后所有管理会话失效，需重新登录。会话最长 8 小时，重启后台后也需重新登录。
- 需要重置密码时，停止容器，将 `data/admin-auth.json` 重命名备份后重启，后台会重新生成默认密码。
- 管理密码在后台校验，写入接口检查会话、来源及词库修订号。多人同时编辑出现冲突时，刷新列表后重试。
- 新增词条保存后，重新打开或刷新游戏页面即可生效，无需重新构建或重启。已打开的题目保持原有答案，避免答到一半题目变化。
- 答题进度仍保存在浏览器。更换端口、域名或浏览器后不会自动迁移，NAS 仅保存词库和管理员密码。
- 默认开启“禁用提示”和“严格模式”，玩家仍可在设置中修改。新版首次使用采用这组默认值，之后记住玩家的选择。

## 从 v0.3.0 升级

备份并保留整个 `data` 目录，停止旧容器，替换新版 `www`、`server` 和 `compose.yaml` 后重新启动。继续使用原端口和地址即可保留浏览器答题记录。请勿覆盖已有数据目录。

## 从 v0.2.0 升级

备份并保留整个 `data` 目录，停止旧容器，用新版 `www`、`server` 和 `compose.yaml` 替换程序文件后重新启动。端口继续使用 13863，浏览器答题记录不变。

首次启动自动将旧 `data/extra-idioms.json` 导入 `data/library-state.json`，以后管理页的词库修改均保存在新文件中。旧文件留作迁移备份，不再读取其中的后续修改。请勿用安装包的空数据覆盖已有 `data` 目录。

## 从 v0.1.0 升级

1. 备份旧项目的 `data` 目录，停止旧项目。
2. 解压新版包，用新版 `www`、`server`、`compose.yaml` 替换旧程序，保留原来的 `data/extra-idioms.json`。旧版 `nginx.conf` 不再使用。
3. 启动新项目。运行镜像改为 Node.js，以支持密码校验和词库写入。
4. 使用新端口 13863 访问。v0.1.0 随机候选范围更大，新版词库版本随之改变，旧随机分享链接会提示版本不匹配。

以前手动添加到扩展库、且与官方每日库重复的词，随机取词时会去重。可以在管理页面查看并删除这些旧条目，新添加和编辑的条目必须通过重复检查。

## 反向代理与维护

使用独立域名或根路径代理，保留请求的 Host，例如 Nginx 的 `proxy_set_header Host $http_host;`。网站启用 HTTPS 后，可在 `.env` 中设置 `COOKIE_SECURE=true`，重新创建容器，让登录 Cookie 仅通过 HTTPS 发送。HTTP 局域网使用保持默认 `false`。

停止：`docker compose down`。日志：`docker compose logs --tail=100`。更新：保留 `data` 后替换程序文件，再运行 `docker compose up -d --force-recreate`。

交付时已测试真实 HTTP 后台、网页和安装包，开发机没有 Docker，尚未在容器或群晖实机运行。

原作：[antfu/handle](https://github.com/antfu/handle)，Anthony Fu 与 Inès，沿用 MIT 许可证。
