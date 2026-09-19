/**
 * PM2 进程编排
 * mall-api   : API 服务（cluster ×2）
 * mall-worker: 常驻 Worker（必须单实例：自动派单 + 72h 结算 + 异步任务消费）
 */
module.exports = {
  apps: [
    {
      name: 'mall-api',
      script: 'src/app.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '500M',
      out_file: './logs/pm2-api-out.log',
      error_file: './logs/pm2-api-err.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'mall-worker',
      script: 'src/worker/index.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '500M',
      out_file: './logs/pm2-worker-out.log',
      error_file: './logs/pm2-worker-err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
