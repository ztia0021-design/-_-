# StudyBridge 全栈在线辅导预约平台

[在线部署](http://34.40.219.79:8083) · [路由说明](34467637_RouterTable.pdf)

Angular 前端与 Node.js / Express / MongoDB 后端，支持导师搜索、课程预约、角色权限及 Socket.io 实时状态同步。

## 目录
- `A2/`：后端 API、数据模型、认证与权限、初始化脚本。
- `A3/`：Angular 前端。
- `34467637_RouterTable.pdf`：路由说明。

## 安装与运行
需要支持项目 Angular 版本的 Node.js / npm，以及 MongoDB。

1. 在 `A2` 运行 `npm ci`，复制 `.env.example` 为 `.env`，配置数据库及自己的 JWT_SECRET。
2. 在 `A3` 运行 `npm ci`，然后运行 `npm run build -- --configuration production --output-path ../frontend`。
3. 在 `A2` 运行 `node --env-file=.env server.js`，访问 `http://localhost:8083`。

`seed.js` 会清空用户和科目集合，仅用于可重建的演示数据库；运行前设置 SEED_ADMIN_PASSWORD。公开源码不包含固定管理员密码、真实 .env、依赖目录或构建产物。

源码来自 34467637_Assignment3.zip；部署地址由项目作者提供。
