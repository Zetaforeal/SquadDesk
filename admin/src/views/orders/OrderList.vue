<template>
  <div>
    <el-card shadow="never">
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="订单号" clearable style="width: 200px" @keyup.enter="load" />
        <el-select v-model="query.payStatus" placeholder="支付状态" clearable style="width: 140px">
          <el-option v-for="(v, k) in PAY_STATUS" :key="k" :label="v" :value="k" />
        </el-select>
        <el-select v-model="query.dispatchStatus" placeholder="派单状态" clearable style="width: 150px">
          <el-option v-for="(v, k) in DISPATCH_STATUS" :key="k" :label="v" :value="k" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="reset">重置</el-button>
        <el-button type="success" @click="openCreate">+ 手动下单</el-button>
      </div>

      <el-table :data="rows" v-loading="loading" stripe>
        <el-table-column prop="orderNo" label="订单号" width="200" />
        <el-table-column label="金额(元)" width="110">
          <template #default="{ row }">{{ row.totalAmount }}</template>
        </el-table-column>
        <el-table-column label="佣金(元)" width="110">
          <template #default="{ row }">{{ row.commissionAmount }}</template>
        </el-table-column>
        <el-table-column prop="dispatchText" label="派单状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.dispatchStatus)" size="small">{{ row.dispatchText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="支付状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.payStatus === 'PAID' ? 'success' : row.payStatus === 'PENDING' ? 'warning' : 'info'" size="small">
              {{ PAY_STATUS[row.payStatus] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="acceptedPlayer?.nickname" label="接单打手" width="110">
          <template #default="{ row }">{{ row.acceptedPlayer?.nickname || '-' }}</template>
        </el-table-column>
        <el-table-column label="商品" min-width="180">
          <template #default="{ row }">
            <div v-for="it in row.items" :key="it.id" class="item-line">{{ it.product?.name }} x{{ it.quantity }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/orders/${row.id}`)">详情</el-button>
            <el-button v-if="row.payStatus === 'PENDING'" link type="success" @click="markPaid(row)">标记已支付</el-button>
            <el-button v-if="['PENDING', 'CANCELLED', 'REFUNDED'].includes(row.payStatus)" link type="danger" @click="removeOrder(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        layout="total, prev, pager, next, sizes"
        :page-sizes="[10, 20, 50]"
        class="pager"
        @change="load"
      />
    </el-card>

    <!-- 手动下单弹窗 -->
    <el-dialog v-model="createVisible" title="手动下单 / 派单" width="560px" destroy-on-close>
      <el-form :model="createForm" label-width="110px">
        <el-form-item label="选择商品" required>
          <el-select v-model="createForm.productId" filterable placeholder="选择商品" style="width: 100%">
            <el-option v-for="p in products" :key="p.id" :label="`${p.name}（¥${p.price}）`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="数量" required>
          <el-input-number v-model="createForm.quantity" :min="1" :max="999" />
        </el-form-item>
        <el-form-item label="收货平台">
          <el-input v-model="createForm.profileData.platform" placeholder="如：王者荣耀" style="width: 100%" />
        </el-form-item>
        <el-form-item label="收货账号">
          <el-input v-model="createForm.profileData.identifier" placeholder="如：游戏账号/ID" style="width: 100%" />
        </el-form-item>
        <el-form-item label="收货地址">
          <el-input v-model="createForm.profileData.address" placeholder="选填" style="width: 100%" />
        </el-form-item>
        <el-form-item label="派单模式" required>
          <el-radio-group v-model="createForm.dispatchMode">
            <el-radio value="GRAB">抢单模式</el-radio>
            <el-radio value="AUTO">自动派单</el-radio>
            <el-radio value="ASSIGN">指定打手</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="createForm.dispatchMode === 'ASSIGN'" label="指定打手" required>
          <el-select v-model="createForm.playerId" filterable placeholder="选择打手（需已上传收款码）" style="width: 100%">
            <el-option v-for="pl in players" :key="pl.id" :label="pl.nickname || pl.username" :value="pl.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="createForm.dispatchMode === 'ASSIGN'">
          <span class="tip">指定打手下单后订单直接进入「进行中」，跳过抢单池</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="submitCreate">确认下单</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/utils/request';

const PAY_STATUS = { PENDING: '待支付', PAID: '已支付', REFUNDED: '已退款', CANCELLED: '已取消' };
const DISPATCH_STATUS = {
  PENDING_GRAB: '待接单', PENDING_PARTNER: '等待搭档确认', IN_PROGRESS: '进行中', SUBMITTED: '待审核',
  PENDING_SETTLE: '待结算', READY_WITHDRAW: '可提现', WITHDRAW_PENDING: '提现审核中',
  PENDING_PAYMENT: '待付款', COMPLETED: '已完成', CANCELLED: '已取消',
};
const TAG_MAP = {
  PENDING_GRAB: 'warning', PENDING_PARTNER: 'warning', IN_PROGRESS: 'primary', SUBMITTED: 'info',
  PENDING_SETTLE: 'info', READY_WITHDRAW: 'success', WITHDRAW_PENDING: 'warning',
  PENDING_PAYMENT: 'danger', COMPLETED: 'success', CANCELLED: 'info',
};

const loading = ref(false);
const rows = ref([]);
const total = ref(0);
const route = useRoute();
const query = reactive({ page: 1, pageSize: 20, keyword: '', payStatus: '', dispatchStatus: '' });

// 支持 URL 参数初始化筛选（如快捷入口 /orders?dispatchStatus=SUBMITTED）
if (route.query.dispatchStatus) query.dispatchStatus = route.query.dispatchStatus;
if (route.query.payStatus) query.payStatus = route.query.payStatus;

function statusTag(s) { return TAG_MAP[s] || 'info'; }
function formatTime(t) { return t ? String(t).replace('T', ' ').slice(0, 19) : '-'; }

async function load() {
  loading.value = true;
  try {
    const data = await request.get('/orders', { params: query });
    rows.value = data.list;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function reset() {
  Object.assign(query, { page: 1, keyword: '', payStatus: '', dispatchStatus: '' });
  load();
}

// ---------- 手动下单 ----------
const createVisible = ref(false);
const creating = ref(false);
const products = ref([]);
const players = ref([]);
const createForm = reactive({
  productId: null,
  quantity: 1,
  profileData: { platform: '', identifier: '', address: '' },
  dispatchMode: 'GRAB',
  playerId: null,
});

async function openCreate() {
  createVisible.value = true;
  Object.assign(createForm, { productId: null, quantity: 1, dispatchMode: 'GRAB', playerId: null, profileData: { platform: '', identifier: '', address: '' } });
  // 加载商品与打手列表
  const [p, pl] = await Promise.all([
    request.get('/products', { params: { page: 1, pageSize: 100 } }),
    request.get('/players', { params: { page: 1, pageSize: 100 } }),
  ]);
  products.value = p.list || [];
  players.value = pl.list || [];
}

async function submitCreate() {
  if (!createForm.productId) return ElMessage.warning('请选择商品');
  if (createForm.dispatchMode === 'ASSIGN' && !createForm.playerId) return ElMessage.warning('指定打手模式请选择打手');
  creating.value = true;
  try {
    const data = await request.post('/orders/admin-create', createForm);
    ElMessage.success(`下单成功：${data.order.orderNo}（${data.order.dispatchType === 'ASSIGN' ? '已派给打手' : data.order.dispatchType === 'AUTO' ? '自动派单中' : '已进抢单池'}）`);
    createVisible.value = false;
    load();
  } catch (e) {
    ElMessage.error(e.message || '下单失败');
  } finally {
    creating.value = false;
  }
}

/** 管理员标记订单为已支付（未配置支付/测试用） */
async function markPaid(row) {
  await ElMessageBox.confirm(`确认将订单 ${row.orderNo} 标记为已支付？`, '标记已支付', { type: 'warning' });
  await request.post(`/orders/${row.id}/mark-paid`);
  ElMessage.success('已标记为已支付，订单进入派单流程');
  load();
}

/** 删除订单（仅待支付/已取消/已退款） */
async function removeOrder(row) {
  await ElMessageBox.confirm(`确认删除订单 ${row.orderNo}？删除后不可恢复。`, '删除订单', { type: 'warning' });
  await request.delete(`/orders/${row.id}`);
  ElMessage.success('订单已删除');
  load();
}

onMounted(load);
</script>

<style scoped>
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.pager { margin-top: 16px; justify-content: flex-end; }
.item-line { font-size: 13px; color: #606266; line-height: 1.6; }
</style>
