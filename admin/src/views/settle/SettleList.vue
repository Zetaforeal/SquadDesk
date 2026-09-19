<template>
  <div>
    <el-card shadow="never">
      <div class="toolbar">
        <el-select v-model="query.status" placeholder="状态" clearable style="width: 150px" @change="load">
          <el-option v-for="(v, k) in DISPATCH_STATUS" :key="k" :label="v" :value="k" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
      </div>

      <el-table :data="rows" v-loading="loading" stripe>
        <el-table-column prop="orderNo" label="订单号" width="200" />
        <el-table-column label="佣金(元)" width="110">
          <template #default="{ row }">{{ row.commissionAmount }}</template>
        </el-table-column>
        <el-table-column prop="acceptedPlayer?.nickname" label="打手" width="120">
          <template #default="{ row }">{{ row.acceptedPlayer?.nickname || '-' }}</template>
        </el-table-column>
        <el-table-column prop="dispatchText" label="状态" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="tagType(row.dispatchStatus)">{{ row.dispatchText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <template v-if="row.dispatchStatus === 'SUBMITTED'">
              <el-button link type="success" @click="approve(row)">通过</el-button>
              <el-button link type="warning" @click="reject(row)">驳回</el-button>
            </template>
            <template v-else-if="row.dispatchStatus === 'PENDING_PAYMENT'">
              <el-button link type="success" @click="pay(row)">扫码付款</el-button>
            </template>
            <el-button link type="primary" @click="$router.push(`/orders/${row.id}`)">详情</el-button>
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
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/utils/request';

const DISPATCH_STATUS = {
  SUBMITTED: '待审核结单', PENDING_SETTLE: '待结算(72h)',
  READY_WITHDRAW: '可提现', WITHDRAW_PENDING: '提现审核中', PENDING_PAYMENT: '待付款',
};

const loading = ref(false);
const rows = ref([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 20, status: 'SUBMITTED' });

function tagType(s) {
  return s === 'PENDING_PAYMENT' ? 'danger' : s === 'COMPLETED' ? 'success' : 'warning';
}

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

async function approve(row) {
  await request.post(`/orders/${row.id}/approve`);
  ElMessage.success('审核通过，进入 72h 冷却');
  load();
}

async function reject(row) {
  const { value } = await ElMessageBox.prompt('请输入驳回原因', '驳回结单');
  await request.post(`/orders/${row.id}/reject`, { reason: value });
  ElMessage.success('已驳回');
  load();
}

async function pay(row) {
  await ElMessageBox.confirm('确认已扫码付款完成？', '确认', { type: 'warning' });
  await request.post(`/pending-payments/${row.id}/pay`);
  ElMessage.success('付款完成，佣金已入账');
  load();
}

onMounted(load);
</script>

<style scoped>
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; }
.pager { margin-top: 16px; justify-content: flex-end; }
</style>
