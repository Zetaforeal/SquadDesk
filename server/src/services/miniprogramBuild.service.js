/**
 * 小程序源码包构建服务（超管一键生成）
 * 按租户生成专属小程序包并打包 zip：
 *   - 注入 tenantId / baseUrl / appid（占位符替换）
 *   - 模板来源：server/../miniprogram（与构建脚本共用）
 */
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { prisma } = require('../db');
const { BizError, Code } = require('../utils/response');
const { getWechatConfig } = require('../models/clubConfig');
const { getSystemConfig } = require('../models/systemConfig');

const SRC = path.join(__dirname, '../../..', 'miniprogram'); // server/src/services/../../../miniprogram = /www/saas/miniprogram
// 注意：域名 saas.numzeta.site 未备案被腾讯云拦截，默认用 IP（备案通过后可在系统配置 miniprogram_base_url 覆盖）
const DEFAULT_BASE_URL = 'http://1.12.220.226';

/** 递归拷贝目录 */
function copyDir(src, dest, excludes = ['node_modules', '.git', 'dist']) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (excludes.includes(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d, excludes);
    else fs.copyFileSync(s, d);
  }
}

/**
 * 生成租户小程序源码目录并打包 zip
 * @param {number} tenantId 租户 ID
 * @param {string} [baseUrl] 可选，默认读系统配置 miniprogram_base_url，兜底 http://saas.numzeta.site
 * @returns {Promise<{zipPath, fileName, club}>}
 */
async function buildMiniprogramZip(tenantId, baseUrl) {
  const club = await prisma.club.findUnique({ where: { id: tenantId } });
  if (!club || club.status !== 1) {
    throw new BizError(Code.NOT_FOUND, '俱乐部不存在或已停用');
  }
  if (!fs.existsSync(SRC)) {
    throw new BizError(Code.INTERNAL_ERROR, '小程序模板目录不存在，请联系平台管理员');
  }

  // baseUrl：优先参数 > 系统配置 > 默认
  if (!baseUrl) {
    baseUrl = (await getSystemConfig('miniprogram_base_url')) || DEFAULT_BASE_URL;
  }

  // 读取该租户 AppID
  const wechat = await getWechatConfig(tenantId);
  const appid = (wechat && wechat.appId) || 'touristappid';

  // 构建目录（临时）
  const distRoot = path.join(__dirname, '../../', 'dist/miniprogram-dl');
  if (!fs.existsSync(distRoot)) fs.mkdirSync(distRoot, { recursive: true });
  const buildDir = path.join(distRoot, `club-${club.code}-${Date.now()}`);
  copyDir(SRC, buildDir);

  // 注入 project.config.json appid
  const projPath = path.join(buildDir, 'project.config.json');
  if (fs.existsSync(projPath)) {
    const proj = JSON.parse(fs.readFileSync(projPath, 'utf8'));
    proj.appid = appid;
    proj.projectname = `club-${club.code}`;
    fs.writeFileSync(projPath, JSON.stringify(proj, null, 2), 'utf8');
  }

  // 注入 app.js baseUrl / tenantId
  const appJsPath = path.join(buildDir, 'app.js');
  if (fs.existsSync(appJsPath)) {
    let appJs = fs.readFileSync(appJsPath, 'utf8');
    appJs = appJs
      .replace(/TENANT_ID_PLACEHOLDER/g, String(tenantId))
      .replace(/BASE_URL_PLACEHOLDER/g, baseUrl);
    fs.writeFileSync(appJsPath, appJs, 'utf8');
  }

  // 打包 zip
  const zipPath = path.join(distRoot, `${club.code}-miniprogram.zip`);
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(buildDir, false);
    archive.finalize();
  });

  // 清理临时构建目录
  fs.rmSync(buildDir, { recursive: true, force: true });

  return {
    zipPath,
    fileName: `${club.code}-miniprogram.zip`,
    club: { id: club.id, code: club.code, name: club.name, appid },
    tenantId,
    baseUrl,
  };
}

module.exports = { buildMiniprogramZip };
