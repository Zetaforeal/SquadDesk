// pages/order-detail/order-detail.js — 订单详情（派单进度展示，取代原 web-view 跳转）
const { request } = require('../../utils/request');
const { parseTime } = require('../../utils/time');

const PROGRESS_STEPS = ['PENDING_GRAB', 'IN_PROGRESS', 'SUBMITTED', 'PENDING_SETTLE', 'READY_WITHDRAW', 'WITHDRAW_PENDING', 'PENDING_PAYMENT', 'COMPLETED'];

// 支付状态文案；已支付时展示派单进度
const PAY_TEXT = {
  PENDING: '待付款',
  PAID: '已付款',
  REFUNDED: '已退款',
  CANCELLED: '已取消',
};

/** 详情页主状态：未支付显示支付状态，已支付显示派单进度 */
function statusTextOf(o) {
  if (o.payStatus === 'PAID') return o.dispatchText || '';
  return PAY_TEXT[o.payStatus] || o.dispatchText || '';
}

Page({
  data: {
    order: null,
    stepIndex: 0,
    steps: [],
  },

  onLoad(options) {
    this.orderId = options.id;
    this.loadOrder();
  },

  async loadOrder() {
    try {
      const order = await request({ url: `/api/orders/${this.orderId}` });
      const stepIndex = PROGRESS_STEPS.indexOf(order.dispatchStatus);
      this.setData({
        order: {
          ...order,
          statusText: statusTextOf(order),
          createdAtText: parseTime(order.createdAt),
          paidAtText: parseTime(order.paidAt),
          completedAtText: parseTime(order.completedAt),
          profileData: order.profileData || {},
        },
        stepIndex: stepIndex >= 0 ? stepIndex : 0,
        steps: [
          { key: 'PENDING_GRAB', text: '等待接单' },
          { key: 'IN_PROGRESS', text: '进行中' },
          { key: 'SUBMITTED', text: '已结单' },
          { key: 'COMPLETED', text: '已完成' },
        ],
      });
    } catch (e) { /* toast 已提示 */ }
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  /** 重新支付（未配置支付时提示联系管理员） */
  async repay() {
    if (this.data.order._paying) return;
    this.setData({ 'order._paying': true });
    try {
      const res = await request({
        url: `/api/orders/${this.orderId}/pay`,
        method: 'POST',
      });
      // 已配置支付：走微信支付
      wx.requestPayment({
        ...res,
        success: () => wx.showToast({ title: '支付成功', icon: 'success' }),
        fail: () => {},
      });
      this.loadOrder();
    } catch (err) {
      // 未配置支付：后端返回明确提示
      wx.showToast({ title: err.message || '支付失败，请联系管理员', icon: 'none' });
    } finally {
      this.setData({ 'order._paying': false });
    }
  },
});
