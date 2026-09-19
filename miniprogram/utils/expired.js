// utils/expired.js — 租户到期拦截
// 到期后小程序完全不可用：显示全屏提示 + 阻止页面数据加载
const app = getApp();

/** 当前是否已到期 */
function isExpired() {
  return app.globalData.expired || !!wx.getStorageSync('tenant_expired');
}

/**
 * 设置到期标记（同时写内存 + 本地存储）
 */
function markExpired() {
  app.globalData.expired = true;
  wx.setStorageSync('tenant_expired', '1');
}

/**
 * 页面 onShow 时调用：若到期则显示全屏到期提示并返回 true（调用方应中止后续逻辑）
 * 返回 Promise，resolve(true) 表示到期需拦截
 */
function guardExpired(page) {
  return new Promise((resolve) => {
    if (!isExpired()) return resolve(false);
    // 已到期：显示全屏覆盖提示，且不加载任何数据
    page.setData({ tenantExpired: true });
    resolve(true);
  });
}

module.exports = { isExpired, markExpired, guardExpired };
