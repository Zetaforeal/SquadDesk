<template>
  <div>
    <el-card shadow="never">
      <div class="toolbar">
        <el-select v-model="query.status" placeholder="状态" clearable style="width: 160px" @change="load">
          <el-option v-for="(v, k) in STATUS_TEXT" :key="k" :label="v" :value="k" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
      </div>

      <el-table :data="rows" v-loading="loading" stripe>
        <el-table-column prop="orderNo" label="订单号" width="190" />
        <el-table-column label="佣金(元)" width="100">
          <template #default="{ row }">{{ row.commissionAmount }}</template>
        </el-table-column>
        <el-table-column prop="dispatchText" label="状态" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="tagType(row.dispatchStatus)">{{ row.dispatchText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="商品" min-width="160">
          <template #default="{ row }">
            <div v-for="it in row.items" :key="it.id">{{ it.product?.name }} x{{ it.quantity }}</div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/orders/${row.id}`)">详情</el-button>
            <el-button v-if="row.dispatchStatus === 'IN_PROGRESS'" link type="success" @click="goSubmit(row)">结单</el-button>
            <template v-if="row.dispatchStatus === 'PENDING_PARTNER'">
              <!-- 我是被邀请的搭档：可同意/拒绝 -->
              <template v-if="row.partnerPlayerId === myId">
                <el-button link type="success" @click="confirmPartner(row)">同意搭档</el-button>
                <el-button link type="danger" @click="rejectPartner(row)">拒绝</el-button>
              </template>
              <!-- 我是发起人：等待搭档确认，可取消邀请 -->
              <template v-else>
                <el-tag size="small" type="warning">等待搭档确认</el-tag>
                <el-button link type="danger" @click="cancelInvite(row)">取消邀请</el-button>
              </template>
            </template>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        layout="total, prev, pager, next"
        class="pager"
        @change="load"
      />
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/utils/request';

const router = useRouter();
const STATUS_TEXT = {
  PENDING_PARTNER: '等待搭档确认', IN_PROGRESS: '进行中', SUBMITTED: '待审核', PENDING_SETTLE: '待结算(72h)',
  READY_WITHDRAW: '可提现', WITHDRAW_PENDING: '提现审核中', PENDING_PAYMENT: '待付款', COMPLETED: '已完成',
};
const TAG = {
  PENDING_PARTNER: 'warning', IN_PROGRESS: 'primary', SUBMITTED: 'info', PENDING_SETTLE: 'info',
  READY_WITHDRAW: 'success', WITHDRAW_PENDING: 'warning', PENDING_PAYMENT: 'danger', COMPLETED: 'success',
};

const loading = ref(false);
const rows = ref([]);
const total = ref(0);
const myId = ref(null);
const query = reactive({ page: 1, pageSize: 20, status: '' });

function tagType(s) { return TAG[s] || 'info'; }

async function load() {
  loading.value = true;
  try {
    // 首次加载顺便拿自己的打手 id（判断搭档/发起人角色）
    if (!myId.value) {
      try {
        const p = await request.get('/profile');
        myId.value = p.id;
      } catch (e) { /* 静默 */ }
    }
    const data = await request.get('/orders', { params: query });
    rows.value = data.list;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function goSubmit(row) {
  router.push(`/orders/${row.id}?action=submit`);
}

/** 同意搭档邀请 → 订单进入进行中 */
async function confirmPartner(row) {
  await ElMessageBox.confirm('确认接受该搭档邀请？确认后订单将进入进行中。', '接受搭档邀请', { type: 'info' });
  await request.post(`/orders/${row.id}/partner/confirm`);
  ElMessage.success('已同意，订单进入进行中');
  load();
}

/** 拒绝搭档邀请 → 订单重回可抢池 */
async function rejectPartner(row) {
  const { value } = await ElMessageBox.prompt('拒绝后将订单释放回抢单池，可填写原因（选填）', '拒绝搭档邀请', { inputPlaceholder: '原因（选填）' });
  await request.post(`/orders/${row.id}/partner/reject`, { reason: value || '' });
  ElMessage.success('已拒绝，订单回到抢单池');
  load();
}

/** 发起人取消搭档邀请 → 订单重回可抢池 */
async function cancelInvite(row) {
  await ElMessageBox.confirm('确认取消搭档邀请？订单将释放回抢单池。', '取消搭档邀请', { type: 'warning' });
  await request.post(`/orders/${row.id}/partner/cancel`);
  ElMessage.success('已取消邀请，订单回到抢单池');
  load();
}

onMounted(load);
</script>

<style scoped>
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; }
.pager { margin-top: 16px; justify-content: flex-end; }
</style>
