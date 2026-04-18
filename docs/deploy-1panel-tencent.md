# 腾讯云轻量 + 1Panel 部署指南（后端测试题）

适用于：**CentOS + Docker + 1Panel**（与控制台截图一致）。目标：同一台机器上可访问 **H5 前端**、**Mock 后端 API**、**网关（含管理端 `/admin`）**。

## 一、放行端口（必须）

在 **腾讯云轻量「防火墙」** 与 **1Panel「主机 → 防火墙」** 中，至少放行：

| 端口 | 用途 |
|------|------|
| 22 | SSH |
| 80 | HTTP（静态站 / 反代入口，推荐） |
| 443 | HTTPS（有域名证书时） |
| 8000 | Mock 后端 API（若**不**做反代，需直连调试时开放） |
| 8080 | 网关 + WebSocket + 管理端（若**不**做反代） |

> 生产建议：只对外开放 **80/443**，用 Nginx/OpenResty 把 `/api` 转到 8000、`/admin` 转到 8080；演示作业为省事可先临时开放 **8000、8080**。

## 二、把代码放到服务器

任选其一：

1. **Git**：在 1Panel「终端」或 SSH 执行  
   `cd /opt && git clone <你的仓库地址> live-debate && cd live-debate`
2. **压缩包**：本地打包 `live-debate`（勿包含各目录下巨大 `node_modules`），用 1Panel「文件」上传到 `/opt/live-debate` 并解压。

## 三、用 Docker Compose 启动后端 + 网关（推荐）

服务器已预装 Docker，在项目根目录（含 `docker-compose.yml`）执行：

```bash
cd /opt/live-debate
docker compose up -d --build
```

验证：

- `curl http://127.0.0.1:8000/health`
- `curl -I http://127.0.0.1:8080/admin`

公网（已放行端口后）：

- 后端：`http://<公网IP>:8000/health`
- 管理端：`http://<公网IP>:8080/admin`  
- 管理页里 `admin/admin.js` 的 `BACKEND_URL` 若为 `http://localhost:8000`，在**你自己电脑浏览器**访问公网 IP 时，应改为：  
  `http://<公网IP>:8000`  
  （或下文反代后的 `https://api.xxx.com`）

修改方式：在服务器上编辑 `gateway/live-gateway-main/admin/admin.js` 中 `BACKEND_URL`，保存后**重启 gateway 容器**：

```bash
cd /opt/live-debate
docker compose restart gateway
```

## 四、部署 H5 前端（公网可打开「前端页面」）

uni-app 需在 **本地 Windows** 用 **HBuilderX**：**发行 → 网站-H5**，生成目录一般为：

`frontend/Live-main/unpackage/dist/build/h5`

1. 将该目录**整体打包**上传到服务器，例如：`/opt/www/live-h5`
2. 在 **1Panel → 网站 → 创建网站 → 静态网站**，根目录指向 `live-h5`，端口 **80**（或按面板指引绑定域名）

### 改 API 地址为公网

发行前在项目中修改：

`frontend/Live-main/config/server-mode.js`

把 `API_BASE_URL` / `REAL_SERVER_URL` 设为：

- `http://<公网IP>:8000`（直连后端），或  
- 若做了 Nginx 反代：`https://你的域名`（仅路径 `/api` 转到后端时，需与前端工程里填写的完整 base 一致）

**重新发行 H5** 后再上传覆盖。

浏览器打开：`http://<公网IP>` 或你的域名，即可作为测试题要求的 **「前端访问地址」**。

## 五、（可选）1Panel + OpenResty/Nginx 反代

在 1Panel「网站」中新建 **反向代理** 站点，示例：

- `https://app.example.com` → 静态目录（H5）
- `https://api.example.com` → `http://127.0.0.1:8000`
- `https://admin.example.com` → `http://127.0.0.1:8080`

前端 `API_BASE_URL` 改为 `https://api.example.com`，管理端 `BACKEND_URL` 同步为同一地址。需在腾讯云防火墙与 1Panel 中放行 **443**，并申请 SSL（1Panel 常支持 Acme）。

## 六、对照测试题自检

| 要求 | 做法 |
|------|------|
| 前后端 Mock、主要接口可演示 | 已用 `backend/server.js`，Compose 拉起即可 |
| 同机部署 | 同一轻量实例上：Compose + 静态站 |
| 在线演示链接 | README 填写 **H5 的 http(s) URL**；**后端 API** 填 `http://IP:8000` 或反代域名 |
| README 诚实项 | 未实现能力写在根目录 `README.md`「限制说明」 |

## 七、常见问题

1. **管理端连不上数据**：检查 `admin.js` 里 `BACKEND_URL` 是否为浏览器能访问的公网地址，而不是 `localhost`。
2. **跨域**：后端已 `cors: *`；若仍报错，检查是否 **http/https 混用** 或浏览器拦截。
3. **WebSocket 失败**：小程序/H5 的 `API_BASE_URL` 与 `getWebSocketUrl()` 必须指向**实际提供 `/ws` 的服务**（8000 或 8080），且防火墙放行对应端口。

---

公网 IP 以你控制台为准；请勿在公开仓库提交服务器密码与密钥。
