// pages/order/order.js — 我的订单（派单进度展示）
const { request } = require('../../utils/request');
const { parseTime } = require('../../utils/time');
const { isLoggedIn, login } = require('../../utils/auth');
const { guardExpired } = require('../../utils/expired');

// 支付状态文案（与后台 PAY_STATUS 一致）；已支付时展示派单进度
const PAY_TEXT = {
  PENDING: '待付款',
  PAID: '已付款',
  REFUNDED: '已退款',
  CANCELLED: '已取消',
};

/** 订单卡片主状态：未支付显示支付状态，已支付显示派单进度 */
function statusTextOf(o) {
  if (o.payStatus === 'PAID') return o.dispatchText || '';
  return PAY_TEXT[o.payStatus] || o.dispatchText || '';
}

Page({
  data: {
    orders: [],
    page: 1,
    pageSize: 10,
    total: 0,
    loading: false,
    hasMore: true,
    needLogin: false,
    tenantExpired: false,
  },

  onShow() {
    guardExpired(this).then((expired) => {
      if (expired) return;
      if (!isLoggedIn()) {
        this.setData({ needLogin: true });
        return;
      }
      this.setData({ needLogin: false });
      this.reload();
    });
  },

  async reload() {
    this.setData({ page: 1, orders: [], hasMore: true });
    await this.loadMore();
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const data = await request({
        url: '/api/orders',
        data: { page: this.data.page, pageSize: this.data.pageSize },
      });
      const list = (data.list || []).map((o) => ({
        ...o,
        createdAtText: parseTime(o.createdAt),
        statusText: statusTextOf(o),
      }));
      this.setData({
        orders: this.data.orders.concat(list),
        total: data.total,
        page: this.data.page + 1,
        hasMore: this.data.orders.length + list.length < data.total,
      });
    } catch (e) {
      // 401 已在 request 中处理
    } finally {
      this.setData({ loading: false });
    }
  },

  onReachBottom() {
    this.loadMore();
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}` });
  },

  noop() {},

  /** 重新支付（未配置支付时不生效，支付成功由管理员后台标记） */
  async repay(e) {
    const id = e.currentTarget.dataset.id;
    const orders = this.data.orders.map((o) => (o.id === id ? { ...o, _paying: true } : o));
    this.setData({ orders });
    try {
      const res = await request({
        url: `/api/orders/${id}/pay`,
        method: 'POST',
      });
      // 已配置支付：走微信支付
      wx.requestPayment({
        ...res,
        success: () => wx.showToast({ title: '支付成功', icon: 'success' }),
        fail: () => {},
      });
      this.reload();
    } catch (err) {
      // 未配置支付：后端返回明确提示，支付成功需管理员后台确认
      wx.showToast({ title: err.message || '支付失败，请联系管理员', icon: 'none' });
    } finally {
      const reset = this.data.orders.map((o) => (o.id === id ? { ...o, _paying: false } : o));
      this.setData({ orders: reset });
    }
  },

  goLogin() {
    login()
      .then(() => {
        wx.showToast({ title: '登录成功', icon: 'success' });
        this.reload();
      })
      .catch(() => {});
  },
});
