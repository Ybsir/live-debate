# 直播辩论 · 后端测试题交付

## 基本信息

| 项 | 说明 |
|----|------|
| 项目名称 | Live Debate — Mock 后端 + 网关联调 + 管理端 |
| 前端仓库 | [Live](https://github.com/xuelinc91-creator/Live)（`frontend/Live-main`） |
| 网关仓库 | [live-gateway](https://github.com/xuelinc91-creator/live-gateway)（`gateway/live-gateway-main`） |

## 演示地址（提交前请替换为你的公网地址）

| 类型 | 地址 |
|------|------|
| 前端 H5（公网） | _部署后填写，例如 `https://xxx.pages.dev`_ |
| 后端 API（公网） | _部署后填写，例如 `https://xxx.onrender.com`_ |
| 管理端（可选） | 本地：`http://localhost:8080/admin`；公网需与网关同域或改 `admin/admin.js` 中 `BACKEND_URL` |

> 本地联调：**后端** `http://localhost:8000`，**网关** `http://localhost:8080`，**管理页静态与 `/static`** 由网关挂载至 `frontend/Live-main/static`。

## 技术栈说明

| 项 | 选择 |
|----|------|
| 后端框架 | Node.js 18+、Express 4 |
| Mock 数据 | 内存对象 / `Map`；启动种子数据（直播流、辩题、AI 片段、票数）；未使用 Faker（可按需扩展） |
| 跨域 | `cors`，`origin: *`，允许 `Authorization` |
| 鉴权 | 演示环境不强制校验 Bearer；生产可接 JWT |
| 部署 | `backend/Dockerfile`；`gateway/live-gateway-main/Dockerfile`；根目录 `docker-compose.yml` 一键起后端+网关 |

## 仓库结构

```
live-debate/
├── backend/
│   ├── server.js          # Mock API + WebSocket /ws
│   ├── package.json
│   └── Dockerfile
├── frontend/Live-main/    # 官方 uni-app（HBuilderX 运行）
├── gateway/live-gateway-main/
│   ├── gateway.js         # 网关 + WebSocket + 管理相关 API
│   ├── Dockerfile         # 需从仓库根目录构建（含 static 拷贝）
│   ├── admin/             # 后台管理静态页
│   └── data/              # JSON 数据（db.js）
├── scripts/
│   └── start-all.ps1      # Windows：新开窗口启动 backend + gateway
├── docker-compose.yml     # backend:8000 + gateway:8080
└── README.md
```

## 主要接口（节选）

| 功能 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 健康检查 | GET | `/health` | |
| 票数 | GET | `/api/votes`、`/api/v1/votes` | `stream_id` |
| 投票 | POST | `/api/v1/user-vote` | `request: { leftVotes, rightVotes, streamId }`，和为 100 |
| 辩题 | GET | `/api/v1/debate-topic` | |
| AI 内容 | GET | `/api/v1/ai-content` | |
| 评论/点赞 | POST | `/api/comment`、`/api/like` | |
| 微信登录 Mock | POST | `/api/wechat-login` | |
| 大屏 Dashboard | GET | `/api/v1/admin/dashboard` | `stream_id` |
| 流列表 | GET | `/api/v1/admin/streams` | |
| 观看人数 | GET | `/api/v1/admin/live/viewers` | 返回 `data.viewers` 与 `data.streams`（管理端兼容） |
| WebSocket | WS | `/ws` | 后端 8000 与网关 8080 均提供（按 `API_BASE_URL` 选择） |

完整列表见 `backend/server.js` 内路由注册。

## 本地运行

### 方式 A：分别启动（开发常用）

```bash
# 终端 1 — Mock 后端
cd backend && npm install && npm start
# 终端 2 — 网关（管理端 http://localhost:8080/admin）
cd gateway/live-gateway-main && npm install && npm start
```

前端：HBuilderX 打开 `frontend/Live-main`，**运行 → 运行到浏览器**；`config/server-mode.js` 中 `API_BASE_URL` 指向 `http://localhost:8000` 或 `8080`（见文件内注释）。

### 方式 B：Docker Compose（贴近「同机部署」）

在**仓库根目录** `live-debate/`：

```bash
docker compose up --build
```

- 后端：<http://localhost:8000/health>
- 网关：<http://localhost:8080/admin>

### 方式 C：Windows 脚本

```powershell
.\scripts\start-all.ps1
```

## 部署上线（提交演示链接）

**腾讯云轻量 + 1Panel + Docker** 逐步说明见：**[docs/deploy-1panel-tencent.md](docs/deploy-1panel-tencent.md)**（防火墙、Compose、H5 上传、管理端 `BACKEND_URL`）。

题目要求：**前端可公网访问 + 接口正常**。常见拆法：

1. **后端**：将 `backend` 部署到 Render / Railway / Fly.io / 云主机 Docker，暴露 HTTPS，设置环境变量 `PORT`。
2. **前端 H5**：HBuilderX **发行 → 网站-H5**，将 `unpackage/dist/build/h5` 静态资源上传到 **Cloudflare Pages / Vercel / Nginx**。
3. **跨域**：将 `frontend/Live-main/config/server-mode.js` 中 `API_BASE_URL` / `REAL_SERVER_URL` 改为你的**公网后端地址**，重新发行 H5。
4. **网关**：若仅需管理端，可将 `gateway` 镜像部署到同一 VPS，端口 `8080`；管理页 `admin/admin.js` 里 `BACKEND_URL` 指向公网后端。

**无法实现或简化的部分**（诚实说明）：

- 真实微信 `jscode2session`、支付、SRS 推拉流：本仓库为 Mock / 占位 URL。
- 部分扩展管理接口（如个别 `debate-flow`）未实现，返回 404 JSON。
- uni-app **小程序**真机需配置合法域名与 HTTPS，与纯 H5 部署步骤不同。

## 开发过程笔记

### 实现思路

- 对照 `utils/api-service.js` 与 `admin/admin-api.js` 实现 Express 路由与 `success/data` 结构。
- 按 `stream_id` 隔离票数与 AI 内容；`/api/v1/admin/live/viewers` 增加 `viewers` 字段以匹配管理端解析。
- 网关中原 404 中间件误放在路由之前，已移至全部路由之后；`/static` 挂载解决管理端图标 404；`judges-management.js` 与 `admin-api.js` 中 `getAPIBase` 重复声明已消除。

### 本地联调

- 后端与网关同时开：`8000` API + `8080` 管理页；或仅后端 + H5 直连 `8000`。
- WebSocket：与 `API_BASE_URL` 同主机 `:端口/ws`。

### 部署踩坑记录（可自行补充）

- Docker 构建网关时上下文须包含 `frontend/Live-main/static`，故 `Dockerfile` 放在网关目录但 **`docker build` 上下文为仓库根目录**（见 `docker-compose.yml`）。
- 浏览器访问管理端时 API 走本机 IP 时注意 `BACKEND_URL` 与防火墙。

### 可扩展性

- 持久化：将内存结构换为 PostgreSQL + Redis（会话/票数缓存）。
- 鉴权：Admin JWT、小程序 session；SRS/腾讯云直播对接真实流地址。

## 个人介绍

_（请填写：姓名/昵称、常用技术栈、方向、本作业耗时与收获等）_

---

## 验收对照（自测）

| 项 | 状态 |
|----|------|
| 项目可运行 | 本地 `health`、H5、管理端可通 |
| 接口覆盖主要业务 | Mock 覆盖投票、辩题、AI、大屏、流、管理端常用 v1 接口 |
| README | 含结构、接口、部署、笔记、限制说明 |
| 可扩展性 | 见上文 |

## 许可证

MIT
