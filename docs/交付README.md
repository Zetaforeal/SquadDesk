# SUPERSAAS · 多租户 SaaS 商城派单系统 — 部署说明

> 本包为系统完整源码（不含依赖与构建产物），按下列步骤即可完整部署运行。

---

## 一、包内容总览

```
交付包/
├── server/          # 后端服务（Express + Prisma + MySQL）
│   ├── src/         # 业务代码（路由/控制器/服务/中间件/Worker）
│   ├── prisma/      # 数据库 Schema
│   ├── scripts/     # 种子数据 / 小程序构建 / 时间校准脚本
│   ├── ecosystem.config.js  # PM2 进程编排（API ×2 + Worker ×1）
│   ├── .env.example # 环境变量模板（复制为 .env 后填写）
│   └── package.json
├── super/           # 平台运营端（Vue3 + Vite，路由前缀 /super/）
├── admin/           # 俱乐部管理端（Vue3 + Vite，路由前缀 /admin/）
├── player/          # 打手工作端（Vue3 + Vite，路由前缀 /player/）
└── miniprogram/     # 微信小程序模板（构建时注入 appid / tenantId / baseUrl）
```

> 运行依赖（node_modules）与前端构建产物（dist）均未包含，需按下方步骤安装与构建。

---

## 二、环境要求

| 组件 | 版本 |
|---|---|
| Node.js | ≥ 20.19 |
| MySQL | 8.0（显式时区 +08:00） |
| PM2 | 最新（进程管理，可选） |
| Nginx | 1.20+（Web 反向代理与静态托管） |

---

## 三、后端部署（server/）

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
vi .env
```

关键项说明：

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | MySQL 连接串，示例：`mysql://root:密码@localhost:3306/super_saas?connection_limit=10&timezone=%2B08:00` |
| `JWT_SECRET` | 必改！随机长字符串 |
| `BASE_URL` | 后端对外根地址（小程序/三端访问用），如 `http://你的域名` |
| `SUPER_ADMIN_USERNAME/PASSWORD` | 平台超管初始账号（仅种子脚本使用） |
| `UPLOAD_DIR` | 上传目录（默认 uploads） |

### 3. 初始化数据库

```bash
# 生成 Prisma Client
npx prisma generate

# 开发环境创建迁移；生产环境只部署仓库内迁移
npm run db:migrate --workspace server
# 生产：npm run db:migrate:deploy --workspace server

# 默认只创建平台超管；演示数据必须显式开启
npm run db:seed --workspace server
```

### 4. 启动服务

```bash
# 方式一：开发模式
npm run dev
npm run worker   # 另开终端启动常驻 Worker（自动派单/结算）

# 方式二：PM2 生产模式（推荐）
pm2 start ecosystem.config.js
pm2 save
```

> 注意：`mall-worker` 必须为**单实例**（自动派单、结算定时任务只允许一个进程执行）。

### 5. 验证

```bash
curl http://localhost:3000/health
```

---

## 四、前端部署（super / admin / player）

三个前端结构一致，以 admin 为例：

```bash
cd admin
npm install
npm run build        # 产物输出到 dist-final/
```

构建完成后，将 `dist-final/` 内容部署到 Nginx 对应目录：

| 端 | 构建目录 | Nginx 路径 |
|---|---|---|
| super | `super/dist-final/` | `/www/saas/super/` |
| admin | `admin/dist-final/` | `/www/saas/admin/` |
| player | `player/dist-final/` | `/www/saas/player/` |

### Nginx 配置要点

```nginx
# 前端静态托管（以 admin 为例，super/player 同理）
location /admin/ {
    alias /www/saas/admin/;
    try_files $uri $uri/ /admin/index.html;
    index index.html;
}

# 后端 API 反代
location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

# 上传文件静态托管
location /uploads/ {
    alias /www/saas/server/uploads/;
}
```

---

## 五、微信小程序部署（miniprogram/）

小程序为**模板工程**，`appid`、`tenantId`、`baseUrl` 均为占位符，两种方式生成专属包：

### 方式一：后端构建脚本（推荐，俱乐部 AppID 从数据库配置读取）

```bash
cd server
node scripts/build-miniprogram.js --club demo001
# 或指定参数
node scripts/build-miniprogram.js \
  --clubs '[{"tenantId":10001,"code":"demo001","appid":"wx你的AppID"}]' \
  --baseUrl http://你的域名
```

产物输出到 `server/dist/miniprogram/<club-code>/`，用**微信开发者工具**打开即可。

### 方式二：手动替换占位符

打开 `miniprogram/` 工程：

- `project.config.json` → `appid` 替换为俱乐部 AppID
- `app.js` → `globalData.tenantId` 替换为俱乐部租户 ID；`globalData.baseUrl` 替换为后端地址

### 真机预览注意事项

- 后端若为 **http（非 https）**，真机预览需在开发者工具勾选 **「不校验合法域名、TLS 版本以及 HTTPS 证书」**，否则请求与图片会被拦截。
- 正式上线请配置 HTTPS 与微信合法域名（request / downloadFile）。

---

## 六、初始账号与演示数据

| 角色 | 账号 | 密码 | 入口 |
|---|---|---|---|
| 平台运营（超管） | `admin` | 由 `.env` 中 SUPER_ADMIN_PASSWORD 指定 | /super/ |
| 演示俱乐部管理员 | `admin` | 由 `DEMO_ADMIN_PASSWORD` 指定 | /admin/ |
| 演示打手 | `player1` / `player2` | 由 `DEMO_PLAYER_PASSWORD` 指定 | /player/ |

> 演示数据默认关闭。只有 `SEED_DEMO_DATA=true` 且两个演示密码均至少 12 位时才会创建。

---

## 七、目录职责速查

| 目录 | 职责 |
|---|---|
| `server/src/routes/` | 四端路由：super / admin / player / user（小程序） |
| `server/src/services/` | 业务逻辑：订单/派单/结算/佣金/商品等 |
| `server/src/middleware/` | 鉴权 / 租户上下文 / 到期拦截 / 上传压缩 |
| `server/src/worker/` | 常驻 Worker：自动派单、冷却结算、异步任务 |
| `server/prisma/schema.prisma` | 全量数据模型（订单双轴状态机等） |
| `miniprogram/utils/` | 小程序请求封装 / 图片双通道 / 到期拦截 |

---

© 2026 SUPERSAAS · 交付版本 V1.0
