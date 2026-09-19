<template>
  <div class="dashboard">
    <el-row :gutter="16">
      <el-col :span="6" v-for="card in statCards" :key="card.label">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-inner">
            <div class="stat-icon" :style="{ background: card.bg, color: card.color }">
              <component :is="card.icon" />
            </div>
            <div>
              <div class="stat-value">{{ card.value }}</div>
              <div class="stat-label">{{ card.label }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="second-row">
      <el-col :span="7">
        <el-card shadow="never" header="待办事项">
          <div class="todo-item" v-for="t in todos" :key="t.label" style="cursor:pointer" @click="goTodo(t)">
            <span>{{ t.label }}</span>
            <el-tag :type="t.count > 0 ? 'danger' : 'info'" size="small">{{ t.count }}</el-tag>
          </div>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card shadow="never">
          <template #header>
            <div class="card-head">
              <span>打手端入口</span>
              <el-tag size="small" type="success">发给打手登录用</el-tag>
            </div>
          </template>
          <div class="entry-line">打手端地址：<a :href="playerUrl" target="_blank">{{ playerUrl }}</a></div>
          <div class="entry-line">俱乐部 ID：<b>{{ tenantId }}</b></div>
          <div class="entry-line entry-tip">打手在打手端用「俱乐部 ID + 账号」登录，账号由你在「打手管理」创建</div>
          <el-button type="primary" size="small" @click="openPlayer">打开打手端</el-button>
          <el-button size="small" @click="copyPlayerInfo">复制打手登录信息</el-button>
        </el-card>
      </el-col>
      <el-col :span="7">
        <el-card shadow="never" header="快捷入口">
          <el-row :gutter="12">
            <el-col :span="12" v-for="quick in quicks" :key="quick.path">
              <el-link type="primary" :href="quick.path" @click.prevent="$router.push(quick.path)" class="quick-link">
                <component :is="quick.icon" class="quick-icon" />
                <span>{{ quick.title }}</span>
              </el-link>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Wallet, Users, ClipboardList, BadgeDollarSign, Package, BadgeCheck } from 'lucide-vue-next';
import request from '@/utils/request';

const router = useRouter();
const stats = ref({});
const statCards = ref([]);
const tenantId = localStorage.getItem('admin_tenantId') || '';
const playerUrl = window.location.origin + '/player/';

function openPlayer() {
  window.open(playerUrl, '_blank');
}

async function copyPlayerInfo() {
  const text = `打手端地址：${playerUrl}\n俱乐部 ID：${tenantId}\n打手账号由俱乐部管理员在「打手管理」中创建后分配`;
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success('已复制打手登录信息');
  } catch (e) {
    ElMessage.error('复制失败，请手动复制');
  }
}
const todos = ref([]);
const quicks = [
  { path: '/orders', title: '订单管理', icon: ClipboardList },
  { path: '/orders?dispatchStatus=SUBMITTED', title: '待审核订单', icon: BadgeCheck },
  { path: '/players', title: '打手管理', icon: Users },
  { path: '/settle', title: '结算管理', icon: BadgeDollarSign },
  { path: '/products', title: '商品管理', icon: Package },
];

/** 待办事项点击跳转（带状态筛选） */
function goTodo(t) {
  if (!t.path) return;
  router.push(t.path);
}

onMounted(async () => {
  stats.value = await request.get('/dashboard/stats');
  const s = stats.value;
  statCards.value = [
    { label: '订单总数', value: s.orderCount, icon: ClipboardList, bg: '#ecf5ff', color: '#409eff' },
    { label: '交易金额(元)', value: s.paidAmount, icon: Wallet, bg: '#fdf6ec', color: '#e6a23c' },
    { label: '打手数量', value: s.playerCount, icon: Users, bg: '#f0f9eb', color: '#67c23a' },
    { label: '已发佣金(元)', value: s.totalCommission, icon: BadgeDollarSign, bg: '#fef0f0', color: '#f56c6c' },
  ];
  todos.value = [
    { label: '待接单', count: s.pendingGrabCount, path: '/orders?dispatchStatus=PENDING_GRAB' },
    { label: '待审核结单', count: s.pendingReviewCount, path: '/orders?dispatchStatus=SUBMITTED' },
    { label: '提现审核', count: s.pendingWithdrawCount, path: '/withdraws' },
    { label: '待付款', count: s.pendingPaymentCount, path: '/orders?dispatchStatus=PENDING_PAYMENT' },
  ];
});
</script>

<style scoped>
.stat-card { margin-bottom: 16px; }
.stat-inner { display: flex; align-items: center; gap: 16px; }
.stat-icon {
  width: 48px; height: 48px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
}
.stat-icon svg { width: 24px; height: 24px; }
.stat-value { font-size: 22px; font-weight: 700; color: #1f2d3d; }
.stat-label { font-size: 13px; color: #909399; margin-top: 2px; }
.todo-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 4px; border-bottom: 1px solid #f0f2f5;
}
.todo-item:last-child { border-bottom: none; }
.quick-link {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 16px 0; width: 100%;
}
.quick-icon { width: 28px; height: 28px; }
.card-head { display: flex; align-items: center; justify-content: space-between; }
.entry-line { font-size: 13px; color: #1f2d3d; line-height: 2; }
.entry-line a { color: #409eff; }
.entry-line b { color: #e6a23c; }
.entry-tip { color: #909399; font-size: 12px; }
</style>
