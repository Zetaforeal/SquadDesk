// pages/product/product.js — 商品详情（下单支付 + 订阅消息授权）
const { request } = require('../../utils/request');
const { resolveImageUrls } = require('../../utils/image');
const { isLoggedIn, login } = require('../../utils/auth');

Page({
  data: {
    product: null,
    quantity: 1,
    profile: { platform: '', identifier: '', address: '' },
    submitting: false,
  },

  onLoad(options) {
    this.productId = options.id;
    this.loadProduct();
    this.loadProfile();
  },

  async loadProduct() {
    try {
      const p = await request({ url: `/api/products/${this.productId}` });
      this.setData({
        product: {
          ...p,
          coverUrl: resolveImageUrls(p.coverUrl),
          images: (p.images || []).map((img) => ({ ...img, url: resolveImageUrls(img.url) })),
        },
      });
    } catch (e) { /* toast 已提示 */ }
  },

  async loadProfile() {
    if (!isLoggedIn()) return;
    try {
      const profile = await request({ url: '/api/user/profile', method: 'GET' });
      if (profile) this.setData({ profile: { platform: profile.platform || '', identifier: profile.identifier || '', address: profile.address || '' } });
    } catch (e) { /* 未登录忽略 */ }
  },

  changeQty(e) {
    const delta = e.currentTarget.dataset.delta;
    let q = this.data.quantity + delta;
    if (q < 1) q = 1;
    this.setData({ quantity: q });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`profile.${field}`]: e.detail.value });
  },

  async saveProfile() {
    const { profile } = this.data;
    await request({ url: '/api/user/profile', method: 'PUT', data: profile });
  },

  // 下单并支付
  async buyNow() {
    if (!this.data.product) return;
    if (this.data.submitting) return;

    // 未登录先静默登录
    if (!isLoggedIn()) {
      try { await login(); } catch (e) { return; }
    }

    await this.saveProfile();

    this.setData({ submitting: true });
    try {
      const res = await request({
        url: '/api/orders',
        method: 'POST',
        data: {
          items: [{ productId: Number(this.productId), quantity: this.data.quantity }],
          profileData: this.data.profile,
        },
      });
      // 调起微信支付
      await this.pay(res.payParams, res.order.id);
    } catch (e) {
      // 错误已 toast
    } finally {
      this.setData({ submitting: false });
    }
  },

  pay(payParams, orderId) {
    return new Promise((resolve, reject) => {
      wx.requestPayment({
        ...payParams,
        success: async (res) => {
          wx.showToast({ title: '支付成功', icon: 'success' });
          // 支付成功后请求订阅消息授权（接单/完成模板，ID 由俱乐部配置）
          this.requestSubscribe();
          wx.redirectTo({ url: `/pages/order-detail/order-detail?id=${orderId}` });
          resolve(res);
        },
        fail: (err) => {
          if (err.errMsg && err.errMsg.includes('cancel')) {
            wx.showToast({ title: '已取消支付', icon: 'none' });
          }
          reject(err);
        },
      });
    });
  },

  // 订阅消息授权（俱乐部后台配置模板 ID，此处留占位由构建注入或后端下发）
  requestSubscribe() {
    wx.requestSubscribeMessage({
      tmplIds: [],
      success: () => {},
      fail: () => {},
    });
  },
});
