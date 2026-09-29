# Handle_Endless 项目约定

- 沟通和时间默认使用中文、Asia/Hong_Kong。
- 每轮功能交付必须启动可访问的本地测试服务器，并提供测试链接。
- 每轮功能交付必须重新构建并生成 Compose ZIP 安装包，提供绝对路径下载链接。
- 保留官方答案表、洗牌逻辑和 MIT 署名；新增成语放入独立词库。
- 修改答题选择、日期或存档逻辑后，运行相关测试和生产构建。
- GitHub 项目为 zhangqihenry/handle-endless，fork 自 antfu/handle。用户已授权发布 1.0.0。后续远程发布按当轮要求执行。

- GitHub README 使用标准项目文档结构，可参考 zhangqihenry/mofang，包含介绍、功能、部署、使用说明和许可证。只有 Release 更新日志采用每条一行、只写结果、语气轻快的格式，不写实现原理、代码位置、列表或前后对比；大版本的 Release 更新日志同样遵循。
- 新增提交和发布作者使用用户 Henry Zhang / zhangqihenry，不添加 AI 作者或协作署名；保留上游提交历史与 MIT 版权声明。

- 项目面向通用 Docker Compose 环境，群晖为一种部署场景；说明 Linux 容器和运行镜像架构要求，不宣称所有设备已实测。
