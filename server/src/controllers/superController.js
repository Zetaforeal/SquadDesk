/**
 * 超级管理端控制器
 */
const { ok, fail, BizError, Code } = require('../utils/response');
const authService = require('../services/auth.service');
const clubService = require('../services/club.service');
const { parsePagination } = require('../utils/pagination');
const { getSystemConfigs, setSystemConfigs } = require('../models/systemConfig');
const fs = require('fs');

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) return fail(res, Code.VALIDATE_ERROR, '参数不完整');
    const result = await authService.superLogin({ username, password });
    return ok(res, result);
  } catch (e) { next(e); }
}

/** 超管修改自己的密码 */
async function changePassword(req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return fail(res, Code.VALIDATE_ERROR, '参数不完整');
    const result = await authService.changeSuperPassword({
      actorId: req.auth.actorId,
      oldPassword,
      newPassword,
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

/** 读取系统配置（安全白名单键） */
async function getSystemConfig(req, res, next) {
  try {
    const ALLOWED_KEYS = ['super_entry_path'];
    const configs = await getSystemConfigs(ALLOWED_KEYS);
    return ok(res, configs);
  } catch (e) { next(e); }
}

/** 更新系统配置（仅白名单键，校验入口路径格式） */
async function updateSystemConfig(req, res, next) {
  try {
    const ALLOWED_KEYS = ['super_entry_path'];
    const entries = {};
    for (const key of ALLOWED_KEYS) {
      if (req.body[key] !== undefined) entries[key] = String(req.body[key]);
    }
    if (entries.super_entry_path !== undefined) {
      const p = entries.super_entry_path.trim().replace(/^\/+|\/+$/g, '');
      if (!p || !/^[a-zA-Z0-9_-]{3,32}$/.test(p)) {
        return fail(res, Code.VALIDATE_ERROR, '入口路径需为 3-32 位字母数字（如 ssuuppeerr）');
      }
      entries.super_entry_path = p;
    }
    if (!Object.keys(entries).length) return fail(res, Code.VALIDATE_ERROR, '无有效配置项');
    await setSystemConfigs(entries);
    return ok(res, { success: true });
  } catch (e) { next(e); }
}

async function listClubs(req, res, next) {
  try {
    const clubs = await clubService.listClubs();
    return ok(res, clubs);
  } catch (e) { next(e); }
}

async function createClub(req, res, next) {
  try {
    const result = await clubService.createClub({ ...req.body });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function updateClub(req, res, next) {
  try {
    const result = await clubService.updateClub(parseInt(req.params.id, 10), req.body);
    return ok(res, result);
  } catch (e) { next(e); }
}

async function deleteClub(req, res, next) {
  try {
    const result = await clubService.deleteClub(parseInt(req.params.id, 10));
    return ok(res, result);
  } catch (e) { next(e); }
}

/** 清除演示版记录（保留俱乐部/商品/管理员，重置订单打手） */
async function resetDemo(req, res, next) {
  try {
    const result = await clubService.resetDemoData(parseInt(req.params.id, 10));
    return ok(res, result);
  } catch (e) { next(e); }
}

/** 一键生成小程序源码包（zip 下载） */
async function buildMiniprogram(req, res, next) {
  try {
    const { buildMiniprogramZip } = require('../services/miniprogramBuild.service');
    const tenantId = parseInt(req.params.id, 10);
    const { baseUrl } = req.body || {};
    const { zipPath, fileName, club } = await buildMiniprogramZip(tenantId, baseUrl);
    res.download(zipPath, fileName, (err) => {
      if (err && !res.headersSent) next(err);
      // 下载完成后清理 zip（延迟删除避免文件占用）
      setTimeout(() => fs.rmSync(zipPath, { force: true }), 5000);
    });
    // 记录构建信息（供前端展示）
    res.locals.buildInfo = club;
  } catch (e) { next(e); }
}

async function stats(req, res, next) {
  try {
    const result = await clubService.globalStats();
    return ok(res, result);
  } catch (e) { next(e); }
}

async function clubOrders(req, res, next) {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const result = await clubService.clubOrders(parseInt(req.params.id, 10), {
      page,
      pageSize,
      status: req.query.status,
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

module.exports = { login, changePassword, getSystemConfig, updateSystemConfig, listClubs, createClub, updateClub, deleteClub, resetDemo, stats, clubOrders, buildMiniprogram };
