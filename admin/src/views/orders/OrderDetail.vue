<template>
  <div v-if="order">
    <el-card shadow="never" class="mb">
      <template #header>
        <div class="card-header">
          <span>订单信息 {{ order.orderNo }}</span>
          <div>
            <el-tag :type="tagType(order.payStatus)" size="small">{{ PAY_STATUS[order.payStatus] }}</el-tag>
            <el-tag :type="tagType(order.dispatchStatus)" size="small" class="ml">{{ order.dispatchText }}</el-tag>
          </div>
        </div>
      </template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="订单金额">{{ order.totalAmount }} 元</el-descriptions-item>
        <el-descriptions-item label="佣金金额">{{ order.commissionAmount }} 元</el-descriptions-item>
        <el-descriptions-item label="佣金比例">{{ (order.commissionRate * 100).toFixed(2) }}%</el-descriptions-item>
        <el-descriptions-item label="接单打手">{{ order.acceptedPlayer?.nickname || '未接单' }}</el-descriptions-item>
        <el-descriptions-item label="派单方式">{{ DISPATCH_TYPE[order.dispatchType] }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ fmt(order.createdAt) }}</el-descriptions-item>
        <el-descriptions-item label="支付时间">{{ fmt(order.paidAt) }}</el-descriptions-item>
        <el-descriptions-item label="结算时间">{{ fmt(order.settleAt) }}</el-descriptions-item>
        <el-descriptions-item label="完成时间">{{ fmt(order.completedAt) }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="never" class="mb">
      <template #header><span>商品明细</span></template>
      <el-table :data="order.items" size="small">
        <el-table-column prop="product?.name" label="商品" />
        <el-table-column prop="quantity" label="数量" width="80" />
        <el-table-column label="单价(元)" width="100">
          <template #default="{ row }">{{ row.price }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card shadow="never" class="mb" v-if="order.profileData">
      <template #header><span>收货资料</span></template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="平台">{{ order.profileData.platform || '-' }}</el-descriptions-item>
        <el-descriptions-item label="账号">{{ order.profileData.identifier || '-' }}</el-descriptions-item>
        <el-descriptions-item label="地址">{{ order.profileData.address || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="never" class="mb" v-if="order.screenshotPath">
      <template #header><span>结单截图</span></template>
      <el-image :src="resolveImg(order.screenshotPath)" style="max-width: 320px" :preview-src-list="[resolveImg(order.screenshotPath)]" fit="contain" />
    </el-card>

    <el-card shadow="never" class="mb">
      <template #header><span>订单沟通</span></template>
      <chat-panel :order-id="order.id" :role="'admin'" />
    </el-card>

    <div class="actions">
      <el-button v-if="order.dispatchStatus === 'PENDING_GRAB'" type="primary" @click="showAssign = true">指派打手</el-button>
      <el-button v-if="order.dispatchStatus === 'PENDING_GRAB'" type="danger" @click="cancelOrder">取消订单</el-button>
      <el-button v-if="order.dispatchStatus === 'SUBMITTED'" type="success" @click="approveSettle">审核通过</el-button>
      <el-button v-if="order.dispatchStatus === 'SUBMITTED'" type="warning" @click="rejectSettle">驳回结单</el-button>
      <el-button v-if="order.dispatchStatus === 'PENDING_PAYMENT'" type="success" @click="payPending">扫码付款完成</el-button>
      <el-button @click="$router.back()">返回</el-button>
    </div>

    <el-dialog v-model="showAssign" title="指派打手" width="420px">
      <el-select v-model="assignPlayerId" placeholder="选择打手" style="width: 100%">
        <el-option v-for="p in players" :key="p.id" :label="`${p.nickname} (${p.username})`" :value="p.id" />
      </el-select>
      <template #footer>
        <el-button @click="showAssign = false">取消</el-button>
        <el-button type="primary" :loading="assigning" @click="doAssign">确定指派</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/utils/request';
import ChatPanel from '@/components/ChatPanel.vue';

const route = useRoute();
const order = ref(null);
const players = ref([]);
const showAssign = ref(false);
const assignPlayerId = ref(null);
const assigning = ref(false);

const PAY_STATUS = { PENDING: '待支付', PAID: '已支付', REFUNDED: '已退款', CANCELLED: '已取消' };
const DISPATCH_TYPE = { GRAB: '抢单', ASSIGN: '指派', AUTO: '自动派单' };

const BASE_URL = '';
function resolveImg(p) { return p && p.startsWith('/uploads/') ? p : p; }
function fmt(t) { return t ? String(t).replace('T', ' ').slice(0, 19) : '-'; }
function tagType(s) {
  return ['PAID', 'COMPLETED'].includes(s) ? 'success' : ['PENDING', 'PENDING_GRAB', 'WITHDRAW_PENDING', 'PENDING_PAYMENT'].includes(s) ? 'warning' : 'info';
}

async function load() {
  order.value = await request.get(`/orders/${route.params.id}`);
}

async function loadPlayers() {
  const data = await request.get('/players', { params: { page: 1, pageSize: 100 } });
  players.value = data.list;
}

async function doAssign() {
  assigning.value = true;
  try {
    await request.post(`/orders/${order.value.id}/assign`, { playerId: assignPlayerId.value });
    ElMessage.success('指派成功');
    showAssign.value = false;
    load();
  } finally {
    assigning.value = false;
  }
}

async function approveSettle() {
  await request.post(`/orders/${order.value.id}/approve`);
  ElMessage.success('审核通过，进入待结算（72h 冷却）');
  load();
}

async function rejectSettle() {
  const { value } = await ElMessageBox.prompt('请输入驳回原因', '驳回结单', { inputPlaceholder: '原因' });
  await request.post(`/orders/${order.value.id}/reject`, { reason: value });
  ElMessage.success('已驳回');
  load();
}

async function payPending() {
  await ElMessageBox.confirm('确认已扫码付款完成？佣金将打入打手账户。', '确认', { type: 'warning' });
  await request.post(`/pending-payments/${order.value.id}/pay`);
  ElMessage.success('付款完成，佣金已入账');
  load();
}

async function cancelOrder() {
  await ElMessageBox.confirm('确认取消该订单？已支付款项将走退款流程。', '警告', { type: 'warning' });
  await request.post(`/orders/${order.value.id}/cancel`);
  ElMessage.success('已取消');
  load();
}

onMounted(() => { load(); loadPlayers(); });
</script>

<style scoped>
.mb { margin-bottom: 16px; }
.ml { margin-left: 8px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.actions { display: flex; gap: 12px; }
</style>
