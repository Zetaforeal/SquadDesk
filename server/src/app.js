/**
 * Express 入口：中间件装配 + 路由挂载
 * 中间件顺序：请求日志 → CORS → body 解析 → 路由 → 404 → 错误处理
 */
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');

const { env } = require('./config');
const requestLog = require('./middleware/requestLog');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
app.disable('x-powered-by');
if (env.TRUST_PROXY) app.set('trust proxy', 1);

// 全局请求日志（需在最早，能捕获后续中间件状态）
app.use(requestLog);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(cors({
  credentials: false,
  origin(origin, callback) {
    if (!origin || env.NODE_ENV !== 'production' || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('CORS origin denied'));
  },
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

// API 响应禁用浏览器缓存（订单/状态等动态数据，避免 ETag 304 导致前端拿到旧数据）
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
});

// 静态托管 uploads（Nginx 生产环境也会托管，此处便于开发）
app.use('/uploads', express.static(path.join(__dirname, '../', env.UPLOAD_DIR)));

// 路由挂载（按端拆分，新增端只需加一个文件）
app.use('/api/user', require('./routes/user.routes'));
app.use('/api/player', require('./routes/player.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/super', require('./routes/super.routes'));
app.use('/api/payment', require('./routes/payment.routes'));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ code: 0, message: 'ok', data: { time: require('./utils/time').formatNow() } });
});

// 404
app.use((req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在: ' + req.method + ' ' + req.originalUrl, data: null });
});

// 全局错误处理（最后）
app.use(errorHandler);

// 启动
if (require.main === module) {
  app.listen(env.PORT, () => {
    logger.info({ event: 'server_started', port: env.PORT, env: env.NODE_ENV, time: require('./utils/time').formatNow() });
    console.log(`[server] mall-api 已启动 http://localhost:${env.PORT}`);
  });
}

module.exports = app;
