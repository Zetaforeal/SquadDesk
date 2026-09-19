/**
 * 种子数据脚本（方案 5.3）
 * 1. 创建平台超管
 * 2. 可选创建演示俱乐部与演示数据（需显式设置 SEED_DEMO_DATA=true）
 *
 * 用法：node scripts/seed.js  （需先 db:push / db:migrate）
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const { prisma } = require('../src/db');
const { env } = require('../src/config');
const { generateOrderNo } = require('../src/utils/orderNo');

async function main() {
  console.log('[seed] 开始初始化种子数据...');

  if (env.SUPER_ADMIN_PASSWORD.length < 12) {
    throw new Error('SUPER_ADMIN_PASSWORD 必须是至少 12 位强密码');
  }

  // 1. 平台超管
  const superExists = await prisma.adminUser.findFirst({ where: { tenantId: null, role: 'SUPER_ADMIN' } });
  if (!superExists) {
    await prisma.adminUser.create({
      data: {
        tenantId: null,
        username: env.SUPER_ADMIN_USERNAME,
        password: bcrypt.hashSync(env.SUPER_ADMIN_PASSWORD, 12),
        role: 'SUPER_ADMIN',
      },
    });
    console.log(`[seed] 超管已创建: ${env.SUPER_ADMIN_USERNAME}`);
  } else {
    console.log('[seed] 超管已存在，跳过');
  }

  if (!env.SEED_DEMO_DATA) {
    console.log('[seed] SEED_DEMO_DATA 未启用，跳过演示数据。');
    return;
  }
  if (env.DEMO_ADMIN_PASSWORD.length < 12 || env.DEMO_PLAYER_PASSWORD.length < 12) {
    throw new Error('启用演示数据时，DEMO_ADMIN_PASSWORD 与 DEMO_PLAYER_PASSWORD 均须至少 12 位');
  }

  // 2. 演示俱乐部（编码 demo001）
  let club = await prisma.club.findUnique({ where: { code: 'demo001' } });
  if (!club) {
    club = await prisma.club.create({
      data: { name: '演示俱乐部', code: 'demo001', status: 1, expiresAt: null },
    });
    await prisma.adminUser.create({
      data: {
        tenantId: club.id,
        username: 'admin',
        password: bcrypt.hashSync(env.DEMO_ADMIN_PASSWORD, 12),
        role: 'CLUB_ADMIN',
      },
    });
    const initialConfigs = {
      wechat_appid: '',
      wechat_secret: '',
      wechat_mchid: '',
      wechat_api_key: '',
      wechat_notify_url: '',
      phone_login_url: '',
      phone_sms_url: '',
      subscribe_tpl_accepted: '',
      subscribe_tpl_completed: '',
      auto_dispatch_enabled: '0',
      auto_dispatch_timeout_seconds: '120',
      profile_col_platform: '平台',
      profile_col_identifier: '账号',
      profile_col_address: '地址',
      profile_col_enabled: '1',
    };
    await prisma.clubConfig.createMany({
      data: Object.entries(initialConfigs).map(([configKey, configValue]) => ({
        tenantId: club.id,
        configKey,
        configValue,
      })),
    });
    console.log('[seed] 演示俱乐部已创建: demo001（管理员 admin）');
  } else {
    console.log('[seed] 演示俱乐部已存在，跳过');
  }

  // 3. 项目 B 种子数据（仅当俱乐部内无打手时写入）
  const playerCount = await prisma.player.count({ where: { tenantId: club.id } });
  if (playerCount === 0) {
    const player1 = await prisma.player.create({
      data: {
        tenantId: club.id,
        username: 'player1',
        password: bcrypt.hashSync(env.DEMO_PLAYER_PASSWORD, 12),
        nickname: '打手一号',
        status: 'active',
        online: false,
        qrcodePath: null,
      },
    });
    const player2 = await prisma.player.create({
      data: {
        tenantId: club.id,
        username: 'player2',
        password: bcrypt.hashSync(env.DEMO_PLAYER_PASSWORD, 12),
        nickname: '打手二号',
        status: 'active',
        online: false,
        qrcodePath: null,
      },
    });

    // 示例分类与商品（供演示下单）
    const cat = await prisma.category.create({
      data: { tenantId: club.id, name: '示例分类', sortOrder: 1, enabled: true },
    });
    const product = await prisma.product.create({
      data: {
        tenantId: club.id,
        categoryId: cat.id,
        name: '示例商品（三角洲陪玩）',
        price: 100,
        description: '种子数据示例商品，佣金比例 80%',
        published: true,
        commissionRate: 0.8,
      },
    });

    // 示例用户（种子订单归属，外键约束需要真实 user）
    const demoUser = await prisma.user.create({
      data: {
        tenantId: club.id,
        openid: `seed_demo_${Date.now()}`,
        nickname: '演示用户',
      },
    });

    // 示例订单（待接单，种子数据：PENDING_GRAB 未支付状态仅作展示）
    const orderNo = generateOrderNo(club.code);
    await prisma.order.create({
      data: {
        tenantId: club.id,
        orderNo,
        userId: demoUser.id,
        totalAmount: 100,
        commissionAmount: 80,
        commissionRate: 0.8,
        payStatus: 'PENDING',
        dispatchStatus: 'PENDING_GRAB',
        profileData: JSON.stringify({ platform: '演示平台', identifier: 'demo_account', address: '示例地址' }),
        items: { create: [{ tenantId: club.id, productId: product.id, quantity: 1, price: 100 }] },
      },
    });
    console.log(`[seed] 项目 B 种子数据已写入: 打手 ${player1.username}/${player2.username}，示例订单 ${orderNo}`);
  } else {
    console.log('[seed] 打手种子数据已存在，跳过');
  }

  console.log('[seed] 完成。');
}

main()
  .catch((e) => {
    console.error('[seed] 失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
