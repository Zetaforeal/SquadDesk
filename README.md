> [!CAUTION]
> **此项目为纯 VibeCoding 项目，并且经过二次重写后暂时没有经过人工核验，不能保证可用性与可靠性，有 Bug 请及时提 Issue。作者不对使用此软件产生的任何法律后果负责。**
>
> 本项目可能存在未发现的业务、数据一致性、安全、支付或部署问题。请勿未经完整审计、测试和合规评估直接用于生产环境、真实交易或处理敏感数据。使用者应自行承担部署、运营、数据安全、资金损失及合规风险。

# SquadDesk

[![CI](https://img.shields.io/github/actions/workflow/status/Zetaforeal/SquadDesk/ci.yml?branch=main&style=flat-square&logo=githubactions&logoColor=white&label=CI)](https://github.com/Zetaforeal/SquadDesk/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520.19-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Vue](https://img.shields.io/badge/Vue-3-42b883?style=flat-square&logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=flat-square&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![GitHub issues](https://img.shields.io/github/issues/Zetaforeal/SquadDesk?style=flat-square&logo=github)](https://github.com/Zetaforeal/SquadDesk/issues)

SquadDesk 是一个多租户商城与派单平台，包含平台运营端、俱乐部管理端、打手工作端、微信小程序模板、后端 API 和后台 Worker。系统覆盖商品管理、订单支付、抢单/派单、搭档协作、结单审核、佣金结算、提现及多租户管理等基本流程。

## 项目状态

- 当前版本：`1.0.0`
- 开发状态：实验性项目，尚未经过人工完整核验
- 推荐用途：学习、原型验证、二次开发和内部测试
- 不推荐用途：未经审计直接用于真实支付、商业运营或关键业务
- 问题反馈：请通过 GitHub Issues 提交，并附带复现步骤、日志和运行环境

## 功能概览

### 平台运营端

- 创建、启用、停用和删除俱乐部租户
- 设置租户有效期、演示版订单数和打手数限制
- 查看全平台俱乐部、用户、订单和交易统计
- 生成指定租户的微信小程序源码包
- 修改平台超级管理员密码

### 俱乐部管理端

- 分类、商品、商品图片和首页布局管理
- 微信登录、微信支付、订阅消息等租户配置
- 创建线下订单、确认线下收款、指派打手
- 订单审核、取消、佣金结算、提现审核和付款确认
- 打手账号、状态和收款码管理
- 管理员与打手订单沟通

### 打手工作端

- 登录、上线和下线
- 查看抢单池、抢单及邀请搭档
- 搭档确认、拒绝和取消
- 提交结单截图与备注
- 查看佣金、申请提现和管理收款码

### 微信小程序

- 微信登录或开发环境模拟登录
- 浏览首页、分类和商品
- 保存用户资料、创建订单和重新支付
- 查看订单及订单状态
- 根据租户生成独立 AppID、后端地址和租户 ID 配置

## 技术栈

| 模块 | 技术 |
|---|---|
| 后端 | Node.js、Express、Prisma |
| 数据库 | MySQL 8.0 |
| 前端 | Vue 3、Vue Router、Element Plus、Vite |
| 小程序 | 原生微信小程序 |
| 任务处理 | 数据库异步任务队列、独立 Worker |
| 日志 | Pino JSON 结构化日志 |
| 进程管理 | PM2（可选） |
| 自动化 | GitHub Actions |

## 仓库结构

```text
SquadDesk/
├─ admin/                 俱乐部管理端，部署路径 /admin/
├─ player/                打手工作端，部署路径 /player/
├─ super/                 平台运营端，部署路径 /super/
├─ miniprogram/           微信小程序模板
├─ server/
│  ├─ prisma/             Prisma Schema 与数据库迁移
│  ├─ scripts/            种子数据、小程序构建、时间同步脚本
│  ├─ src/
│  │  ├─ controllers/     HTTP 控制器
│  │  ├─ middleware/      鉴权、租户、限流、上传等中间件
│  │  ├─ routes/          API 路由
│  │  ├─ services/        业务服务
│  │  ├─ worker/          后台 Worker
│  │  └─ jobs/            异步任务处理器
│  └─ .env.example        环境变量示例
├─ docs/                  产品与部署资料
├─ .github/workflows/     GitHub Actions
├─ package.json           npm workspace 根配置
└─ package-lock.json      统一依赖锁文件
```

## 环境要求

- Node.js `20.19` 或更高版本
- npm `10` 或更高版本
- MySQL `8.0`
- 微信开发者工具：仅开发或发布小程序时需要
- PM2、Nginx：仅生产部署时需要

建议在开始前确认版本：

```bash
node --version
npm --version
mysql --version
```

## 快速开始

### 1. 获取源码并安装依赖

```bash
git clone https://github.com/Zetaforeal/SquadDesk.git
cd SquadDesk
npm install
```

项目使用 npm workspaces。请在仓库根目录统一安装依赖，不要分别维护四份锁文件。

### 2. 创建 MySQL 数据库

```sql
CREATE DATABASE super_saas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

建议为项目创建权限受限的独立数据库账号，不要在生产环境长期使用 `root`。

### 3. 创建环境变量文件

Linux/macOS：

```bash
cp server/.env.example server/.env
```

Windows PowerShell：

```powershell
Copy-Item server/.env.example server/.env
```

然后编辑 `server/.env`：

```dotenv
NODE_ENV=development
PORT=3000

DATABASE_URL="mysql://用户名:密码@127.0.0.1:3306/super_saas?connection_limit=10&timezone=%2B08:00"

JWT_SECRET=请替换为至少32位的随机字符串
JWT_EXPIRES_IN=7d

BASE_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175
TRUST_PROXY=false
ALLOW_DEV_LOGIN=false

SUPER_ADMIN_USERNAME=admin
SUPER_ADMIN_PASSWORD=请替换为至少12位的强密码

SEED_DEMO_DATA=false
DEMO_ADMIN_PASSWORD=
DEMO_PLAYER_PASSWORD=

UPLOAD_DIR=uploads
UPLOAD_MAX_SIZE_MB=10
```

主要变量说明：

| 变量 | 必需 | 说明 |
|---|---:|---|
| `NODE_ENV` | 是 | `development`、`test` 或 `production` |
| `PORT` | 否 | API 端口，默认 `3000` |
| `DATABASE_URL` | 是 | MySQL 连接字符串 |
| `JWT_SECRET` | 是 | JWT 密钥；生产环境至少 32 位随机值 |
| `JWT_EXPIRES_IN` | 否 | 登录令牌有效期，默认 `7d` |
| `BASE_URL` | 是 | 后端公开地址，不包含末尾 `/` |
| `CORS_ORIGINS` | 生产必需 | 允许访问 API 的前端来源，多个值用逗号分隔 |
| `TRUST_PROXY` | 否 | API 位于可信反向代理后时设置为 `true` |
| `ALLOW_DEV_LOGIN` | 否 | 开发模拟登录；生产环境禁止开启 |
| `SUPER_ADMIN_USERNAME` | 是 | 种子脚本创建的超级管理员用户名 |
| `SUPER_ADMIN_PASSWORD` | 是 | 至少 12 位，不会写入日志 |
| `SEED_DEMO_DATA` | 否 | 是否创建演示俱乐部和演示订单，默认关闭 |
| `DEMO_ADMIN_PASSWORD` | 条件必需 | 启用演示数据时至少 12 位 |
| `DEMO_PLAYER_PASSWORD` | 条件必需 | 启用演示数据时至少 12 位 |
| `TIME_SYNC_URLS` | 否 | 网络时间源，多个地址用逗号分隔 |
| `TIME_SYNC_INTERVAL_HOURS` | 否 | 时间重新校准间隔 |
| `UPLOAD_DIR` | 否 | 上传目录，默认 `uploads` |
| `UPLOAD_MAX_SIZE_MB` | 否 | 单张上传图片上限，最大允许配置为 25 MB |

生产模式下，如果数据库、JWT、强密码或 CORS 白名单不符合要求，后端会拒绝启动。

### 4. 初始化数据库

生成 Prisma Client：

```bash
npm run db:generate --workspace server
```

全新数据库使用仓库内迁移：

```bash
npm run db:migrate:deploy --workspace server
```

开发新迁移时使用：

```bash
npm run db:migrate --workspace server
```

创建超级管理员：

```bash
npm run db:seed --workspace server
```

默认只创建超级管理员。若确实需要演示数据，请在 `.env` 中设置：

```dotenv
SEED_DEMO_DATA=true
DEMO_ADMIN_PASSWORD=至少12位的演示管理员密码
DEMO_PLAYER_PASSWORD=至少12位的演示打手密码
```

> [!WARNING]
> 如果你已经有使用 `prisma db push` 创建的旧数据库，不要直接对其执行初始迁移。请先备份数据库、比较现有结构与 `server/prisma/schema.prisma`，确认一致后再使用 Prisma 的 `migrate resolve` 建立迁移基线。

### 5. 启动开发环境

分别打开终端运行以下命令。

后端 API：

```bash
npm run dev:server
```

后台 Worker：

```bash
npm run worker --workspace server
```

三个 Web 前端：

```bash
npm run dev:super
npm run dev:admin
npm run dev:player
```

默认访问地址：

| 服务 | 地址 |
|---|---|
| API 健康检查 | `http://localhost:3000/health` |
| 平台运营端 | `http://localhost:5175/super/` |
| 俱乐部管理端 | `http://localhost:5173/admin/` |
| 打手工作端 | `http://localhost:5174/player/` |

首次运行时，使用 `.env` 中的 `SUPER_ADMIN_USERNAME` 和 `SUPER_ADMIN_PASSWORD` 登录平台运营端。

## 完整使用流程

### 1. 创建俱乐部

1. 登录平台运营端 `/super/`。
2. 打开“俱乐部管理”。
3. 填写俱乐部名称、唯一编码、管理员用户名和至少 12 位的初始密码。
4. 按需设置有效期、打手上限、订单上限及微信 AppID。
5. 创建成功后记录俱乐部 ID；俱乐部管理员和打手登录时都需要该 ID。

### 2. 配置俱乐部

1. 使用俱乐部 ID、管理员用户名和密码登录 `/admin/`。
2. 在设置页面填写微信 AppID、AppSecret、商户号、API v2 密钥和支付回调地址。
3. 设置自动派单、结算冷却期、用户资料字段和客服链接。
4. 创建分类和商品，设置价格、佣金比例、封面及详情图片。
5. 在首页装修页面配置轮播图、活动区和商品列表。

微信支付回调地址通常设置为：

```text
https://你的域名/api/payment/notify
```

### 3. 创建打手账号

1. 在俱乐部管理端进入打手管理。
2. 创建用户名、昵称和至少 12 位的初始密码。
3. 打手登录 `/player/` 后上传收款二维码并切换为上线状态。
4. 只有启用、上线且已配置收款码的打手才能参与抢单或自动派单。

### 4. 订单与派单

用户可以从小程序创建订单；管理员也可以在后台创建线下订单。支付完成后，订单按照设置进入抢单、自动派单或指定派单流程。

典型状态流程：

```text
待支付 → 已支付/待接单 → 进行中 → 待审核 → 冷却中
       → 可提现 → 提现审核 → 待付款 → 已完成
```

带搭档的订单需要被邀请人确认后才会进入“进行中”。订单状态迁移由后端校验，不应通过数据库手工修改。

### 5. 结单与佣金

1. 打手提交结单截图和备注。
2. 管理员审核通过后，订单进入结算冷却期。
3. 冷却期结束后，打手申请提现。
4. 管理员审核提现并线下扫码付款。
5. 管理员确认付款完成后，佣金写入打手账户；搭档订单默认平分佣金。

## 微信小程序

模板位于 `miniprogram/`。其中的租户 ID 和后端地址是占位符，不应直接发布。

### 从平台运营端生成

在俱乐部列表中点击“生成小程序”，系统会根据该俱乐部的租户 ID、编码和微信 AppID 生成源码压缩包。

### 使用命令行生成

从数据库读取全部启用俱乐部：

```bash
cd server
node scripts/build-miniprogram.js --baseUrl https://api.example.com
```

只生成指定编码的俱乐部：

```bash
node scripts/build-miniprogram.js --club club001 --baseUrl https://api.example.com
```

不连接数据库，直接传入俱乐部数据：

```bash
node scripts/build-miniprogram.js \
  --clubs '[{"tenantId":10001,"code":"club001","appid":"wx你的AppID"}]' \
  --baseUrl https://api.example.com
```

生成目录为 `server/dist/miniprogram/<俱乐部编码>/`。使用微信开发者工具打开对应目录，配置合法域名后再预览或上传。

正式发布要求：

- API 使用有效 HTTPS 证书。
- 在微信公众平台配置 request、uploadFile 和 downloadFile 合法域名。
- 小程序 AppID 与租户配置一致。
- 不开启“不校验合法域名”作为生产解决方案。

## API 路径

| 前缀 | 用途 | 鉴权 |
|---|---|---|
| `/api/user` | 小程序登录、商品、资料和订单 | 公开接口或用户 JWT |
| `/api/player` | 打手、抢单、结单、提现和聊天 | 打手 JWT |
| `/api/admin` | 俱乐部管理、商品、订单、结算和配置 | 俱乐部管理员 JWT |
| `/api/super` | 租户、全局统计和小程序构建 | 超级管理员 JWT |
| `/api/payment/notify` | 微信支付回调 | 微信签名验证 |
| `/uploads` | 上传图片访问路径 | 静态资源 |
| `/health` | 服务健康检查 | 无 |

请求成功时通常返回：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

业务错误主要通过响应体中的 `code` 表示；未处理的服务器错误使用 HTTP 500。

## 构建与生产部署

### 1. 构建前端

在仓库根目录执行：

```bash
npm run build
```

输出目录：

- `admin/dist-final/`
- `player/dist-final/`
- `super/dist-final/`

### 2. 部署数据库

```bash
npm ci
npm run db:generate --workspace server
npm run db:migrate:deploy --workspace server
```

生产环境应由部署系统注入 `server/.env` 对应的环境变量，不要把真实 `.env` 上传到 GitHub。

### 3. 使用 PM2 启动后端

```bash
cd server
mkdir -p logs uploads
pm2 start ecosystem.config.js
pm2 save
pm2 status
```

PM2 配置默认启动：

- `mall-api`：两个 cluster 实例。
- `mall-worker`：一个实例。

Worker 必须保持单实例运行，负责自动派单、结算冷却和异步通知任务。

### 4. Nginx 示例

```nginx
server {
    listen 80;
    server_name example.com;

    location /super/ {
        alias /www/supersaas/super/;
        try_files $uri $uri/ /super/index.html;
    }

    location /admin/ {
        alias /www/supersaas/admin/;
        try_files $uri $uri/ /admin/index.html;
    }

    location /player/ {
        alias /www/supersaas/player/;
        try_files $uri $uri/ /player/index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        alias /www/supersaas/server/uploads/;
    }
}
```

启用 HTTPS 后，应将 `BASE_URL`、`CORS_ORIGINS`、微信支付回调地址和小程序合法域名同步改为正式域名。如果通过 Nginx 等可信代理获取客户端 IP，请设置 `TRUST_PROXY=true`。

## 测试与质量检查

```bash
# 后端单元测试
npm test

# 三个前端生产构建
npm run build

# Prisma Schema 校验
npm exec --workspace server -- prisma validate --schema prisma/schema.prisma

# 依赖漏洞检查
npm audit --workspaces --audit-level=high
```

推送到 GitHub 后，`.github/workflows/ci.yml` 会执行依赖安装、Prisma Client 生成、Schema 校验、测试、构建和依赖审计。

当前测试覆盖仍然有限，测试通过不代表业务流程、真实支付、并发场景或生产部署已经得到充分验证。

## 安全注意事项

- 不要提交 `server/.env`、数据库备份、上传文件或真实密钥。
- 生产环境必须使用独立数据库账号和强随机 JWT 密钥。
- `ALLOW_DEV_LOGIN` 在生产环境必须保持 `false`。
- 不要继续使用示例密码或把密码写入测试脚本。
- 上传目录应限制执行权限，并由 Nginx 仅作为静态文件提供。
- 定期备份 MySQL 和 `uploads/`，并实际测试恢复流程。
- 建议在公网部署前进行代码审计、依赖审计、渗透测试和支付流程审计。
- 租户管理员可以配置微信密钥，应限制管理后台的访问来源并启用 HTTPS。

## 当前已知限制

- 项目经过自动化二次重写，但尚未进行人工逐功能验收。
- 手机短信供应商协议仍需按实际服务商进行二次开发。
- 微信退款接口尚未接入；真实微信支付订单不会仅通过修改本地状态来伪造退款成功。
- 当前异步队列基于数据库，适合中小规模部署；高吞吐场景建议评估 Redis/BullMQ 等方案。
- 聊天采用轮询，不是 WebSocket 实时推送。
- 自动化测试以核心工具函数和构建检查为主，尚缺少完整数据库集成测试和端到端测试。
- 未对所有国家或地区的支付、隐私、税务、消费者保护及平台规则进行合规验证。

## 常见问题

### 后端提示生产配置不安全

检查 `DATABASE_URL`、`JWT_SECRET`、`SUPER_ADMIN_PASSWORD` 和 `CORS_ORIGINS`。生产环境不能开启 `ALLOW_DEV_LOGIN`。

### Prisma 无法连接数据库

确认 MySQL 已启动、数据库已创建、账号有权限，并检查连接字符串中的特殊字符是否已进行 URL 编码。

### 前端请求返回 401

登录信息已过期、租户被停用或 JWT 配置发生变化。清除浏览器对应端的本地存储后重新登录。

### 打手看不到订单

确认打手账号处于启用状态，已经上线并上传收款二维码；同时确认订单已经支付且处于待接单状态。

### 小程序无法请求 API

检查生成包中的 `tenantId`、`baseUrl` 和 AppID，并确认 HTTPS、合法域名、证书链以及服务器 CORS 配置正确。

### 支付回调失败

检查 AppID、商户号、API v2 密钥、回调 URL、订单金额和服务器时间。不要在日志或 Issue 中公开商户密钥及完整支付报文。

## 上传到 GitHub

项目已经包含 `.gitignore`，默认排除 `.env`、`node_modules`、构建产物、日志、上传文件和本地配置。上传前仍应自行检查：

```bash
git status
git diff --cached
git grep -n -I -E "password|secret|api[_-]?key|token"
```

首次提交与推送示例：

```bash
git config user.name "你的名字"
git config user.email "你的邮箱"
git commit -m "Initial SquadDesk release"
git remote add origin https://github.com/Zetaforeal/SquadDesk.git
git push -u origin main
```

如果已经存在 `origin`，使用 `git remote set-url origin <仓库地址>` 修改，不要重复添加。

## 提交 Issue

提交问题时建议包含：

1. 操作系统、Node.js、npm 和 MySQL 版本。
2. 使用的提交版本或 Commit SHA。
3. 问题发生前的完整操作步骤。
4. 预期结果与实际结果。
5. 已脱敏的错误日志和截图。
6. 是否可以稳定复现。

请勿在 Issue 中提交 `.env`、JWT、Cookie、AppSecret、API Key、数据库密码、手机号、支付订单号或其他敏感信息。

## 贡献

欢迎通过 Issue 报告问题，也欢迎提交 Pull Request。由于项目尚未完成人工核验，修改核心订单、支付、结算、租户隔离或权限逻辑时，请同时补充相应测试和迁移说明。

## 许可证与免责声明

本项目采用 [MIT License](LICENSE)。你可以在遵守许可证条款并保留版权与许可声明的前提下使用、复制、修改、发布和分发本软件。

本软件按“现状”提供，不附带任何形式的可用性、适销性、特定用途适用性、安全性或不侵权保证。使用者应自行完成技术、安全与法律评估，并自行承担因安装、部署、修改、运营或使用本软件产生的全部风险与后果。作者不对任何直接、间接、附带、特殊、惩罚性或后果性损失承担责任。
