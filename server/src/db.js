/**
 * Prisma 客户端单例（唯一出口）
 * 所有 models / services / worker 统一从此引入 prisma
 */
const { PrismaClient } = require('@prisma/client');
const { env } = require('./config');

const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// 优雅退出时断开连接
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = { prisma };
