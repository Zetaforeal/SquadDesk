/**
 * 多俱乐部小程序构建脚本（方案 6.3）
 * 为每个启用中的俱乐部生成独立构建目录：
 *   dist/miniprogram/<club-code>/
 *     ├── project.config.json   # appid = 该俱乐部 AppID
 *     ├── app.js                # baseUrl = api 域名, tenantId = 租户ID
 *     └── 其余模板文件原样拷贝
 *
 * 用法（在 server/ 目录下）：
 *   node scripts/build-miniprogram.js                  # 从数据库拉取全部启用俱乐部
 *   node scripts/build-miniprogram.js --club demo001   # 只构建指定俱乐部
 *   node scripts/build-miniprogram.js --src ../miniprogram --dist dist/miniprogram
 */
const fs = require('fs');
const path = require('path');

// 参数解析
const args = process.argv.slice(2);
function argValue(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

const SRC = argValue('--src') || path.join(__dirname, '../../miniprogram');
const DIST = argValue('--dist') || path.join(__dirname, '../dist/miniprogram');
const BASE_URL = argValue('--baseUrl') || process.env.BUILD_BASE_URL || 'https://api.club-saas.com';
const onlyClub = argValue('--club');

async function getClubs() {
  // 避免依赖 DB 时可直接用 --clubs 传 JSON
  const clubsArg = argValue('--clubs');
  if (clubsArg) return JSON.parse(clubsArg);

  // 从数据库拉取（要求已生成 Prisma Client）
  try {
    const { prisma } = require('../src/db');
    const clubs = await prisma.club.findMany({
      where: { status: 1 },
      select: { id: true, code: true, name: true },
    });
    await prisma.$disconnect();
    return clubs.map((c) => ({
      tenantId: c.id,
      code: c.code,
      name: c.name,
      // AppID 需结合 club_configs 读取，此处从配置文件读取
      appid: '',
    }));
  } catch (e) {
    console.error('[build] 数据库拉取失败（未初始化或缺少 @prisma/client）:', e.message);
    console.error('[build] 请改用 --clubs \'[{"tenantId":1,"code":"demo001","appid":"wx..."}]\' 手动传入');
    process.exit(1);
  }
}

/** 递归拷贝目录（排除指定文件） */
function copyDir(src, dest, excludes = []) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (excludes.includes(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d, excludes);
    else fs.copyFileSync(s, d);
  }
}

function buildOne(club) {
  const target = path.join(DIST, club.code);
  copyDir(SRC, target, ['node_modules', '.git', 'dist']);

  // 1. project.config.json 注入 appid
  const projPath = path.join(target, 'project.config.json');
  if (fs.existsSync(projPath)) {
    const proj = JSON.parse(fs.readFileSync(projPath, 'utf8'));
    if (club.appid) proj.appid = club.appid;
    fs.writeFileSync(projPath, JSON.stringify(proj, null, 2), 'utf8');
  }

  // 2. app.js 注入 baseUrl / tenantId（占位符替换）
  const appJsPath = path.join(target, 'app.js');
  if (fs.existsSync(appJsPath)) {
    let appJs = fs.readFileSync(appJsPath, 'utf8');
    appJs = appJs
      .replace(/TENANT_ID_PLACEHOLDER/g, String(club.tenantId))
      .replace(/BASE_URL_PLACEHOLDER/g, BASE_URL);
    fs.writeFileSync(appJsPath, appJs, 'utf8');
  }

  // 3. project.config.json 的 appid 占位符兜底
  if (club.appid) {
    const projPath2 = path.join(target, 'project.config.json');
    if (fs.existsSync(projPath2)) {
      let s = fs.readFileSync(projPath2, 'utf8');
      s = s.replace(/APPID_PLACEHOLDER/g, club.appid);
      fs.writeFileSync(projPath2, s, 'utf8');
    }
  }

  console.log(`[build] 已生成: ${target} (tenantId=${club.tenantId}, appid=${club.appid || '占位符'})`);
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`[build] 小程序模板目录不存在: ${SRC}`);
    process.exit(1);
  }
  let clubs = await getClubs();
  if (onlyClub) clubs = clubs.filter((c) => c.code === onlyClub);
  if (!clubs.length) {
    console.error('[build] 没有可构建的俱乐部');
    process.exit(1);
  }
  // 读取每个俱乐部的 AppID（club_configs）
  try {
    const { prisma } = require('../src/db');
    for (const c of clubs) {
      const row = await prisma.clubConfig.findUnique({
        where: { tenantId_configKey: { tenantId: c.tenantId, configKey: 'wechat_appid' } },
      });
      if (row && row.configValue) c.appid = row.configValue;
    }
    await prisma.$disconnect();
  } catch (e) {
    console.warn('[build] 读取 AppID 配置失败（忽略，使用占位符）:', e.message);
  }
  clubs.forEach(buildOne);
  console.log(`[build] 完成，共 ${clubs.length} 个俱乐部构建到 ${DIST}`);
}

main();
