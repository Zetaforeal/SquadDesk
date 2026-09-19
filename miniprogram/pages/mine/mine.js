// pages/mine/mine.js — 我的（个人信息 + 联系客服）
const { request } = require('../../utils/request');
const { isLoggedIn, login } = require('../../utils/auth');
const { guardExpired } = require('../../utils/expired');

Page({
  data: {
    loggedIn: false,
    user: null,
    profile: null,
    customerServiceLink: '',
    tenantExpired: false,
  },

  onShow() {
    guardExpired(this).then((expired) => {
      if (expired) return;
      this.setData({ loggedIn: isLoggedIn(), user: getApp().globalData.userInfo || null });
      if (isLoggedIn()) this.loadProfile();
      this.loadCustomerService();
    });
  },

  async loadProfile() {
    try {
      const profile = await request({ url: '/api/user/profile', method: 'GET' });
      this.setData({ profile });
    } catch (e) { /* 忽略 */ }
  },

  /** 读取俱乐部客服配置（管理员后台设置） */
  async loadCustomerService() {
    try {
      const config = await request({ url: '/api/club/config', method: 'GET' });
      this.setData({ customerServiceLink: (config && config.customer_service_link) || '' });
    } catch (e) { /* 忽略 */ }
  },

  /** 联系客服：跳转到管理员配置的链接 */
  contactService() {
    const link = this.data.customerServiceLink;
    if (!link) {
      wx.showToast({ title: '暂未设置客服联系方式', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: link,
      success: () => {
        wx.showModal({
          title: '联系客服',
          content: '客服链接已复制，请粘贴到浏览器打开',
          showCancel: false,
          confirmText: '好的',
        });
      },
    });
  },

  async doLogin() {
    try {
      await login();
      this.setData({ loggedIn: true, user: getApp().globalData.userInfo });
      wx.showToast({ title: '登录成功', icon: 'success' });
      this.loadProfile();
    } catch (e) { /* toast 已提示 */ }
  },

  goOrders() {
    wx.switchTab({ url: '/pages/order/order' });
  },
});
