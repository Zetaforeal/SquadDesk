<template>
  <el-card shadow="never">
    <el-table :data="rows" v-loading="loading" stripe>
      <el-table-column prop="orderNo" label="订单号" width="200" />
      <el-table-column label="佣金(元)" width="110">
        <template #default="{ row }">{{ row.commissionAmount }}</template>
      </el-table-column>
      <el-table-column prop="acceptedPlayer?.nickname" label="打手" width="120">
        <template #default="{ row }">{{ row.acceptedPlayer?.nickname || '-' }}</template>
      </el-table-column>
      <el-table-column label="收款码" width="100">
        <template #default="{ row }">
          <el-image v-if="row.acceptedPlayer?.qrcodePath" :src="row.acceptedPlayer.qrcodePath" fit="cover" style="width: 48px; height: 48px; border-radius: 6px" :preview-src-list="[row.acceptedPlayer.qrcodePath]" />
          <el-tag v-else size="small" type="danger">缺失</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="申请时间" width="170">
        <template #default="{ row }">{{ fmt(row.withdrawAppliedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="success" @click="approve(row)">通过</el-button>
          <el-button link type="danger" @click="reject(row)">驳回</el-button>
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

    <!-- 通过审核 → 弹出收款码付款弹窗 -->
    <el-dialog v-model="payDialog.visible" title="扫码付款" width="420px" :close-on-click-modal="false">
      <div v-if="payDialog.row" class="pay-box">
        <div class="pay-tip">请扫描打手收款码完成付款</div>
        <div class="pay-qrcode">
          <el-image
            v-if="payDialog.row.acceptedPlayer?.qrcodePath"
            :src="payDialog.row.acceptedPlayer.qrcodePath"
            fit="contain"
            style="width: 220px; height: 220px; border: 1px solid #e4e7ed; border-radius: 8px"
            :preview-src-list="[payDialog.row.acceptedPlayer.qrcodePath]"
          />
          <el-empty v-else description="打手未上传收款码" :image-size="80" />
        </div>
        <el-descriptions :column="1" border size="small" class="pay-info">
          <el-descriptions-item label="打手">{{ payDialog.row.acceptedPlayer?.nickname || '-' }}</el-descriptions-item>
          <el-descriptions-item label="订单号">{{ payDialog.row.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="付款金额">
            <b style="color: #f56c6c">¥{{ payDialog.row.commissionAmount }}</b>
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="payDialog.visible = false">稍后处理</el-button>
        <el-button type="success" :loading="paying" @click="confirmPay">已扫码付款</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/utils/request';

const loading = ref(false);
const paying = ref(false);
const rows = ref([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 20 });
const payDialog = reactive({ visible: false, row: null });

function fmt(t) { return t ? String(t).replace('T', ' ').slice(0, 19) : '-'; }

async function load() {
  loading.value = true;
  try {
    const data = await request.get('/withdraws', { params: query });
    rows.value = data.list;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

async function approve(row) {
  await ElMessageBox.confirm('确认提现审核通过？将进入扫码付款。', '确认', { type: 'warning' });
  await request.post(`/withdraws/${row.id}/approve`);
  // 审核通过后弹出打手收款码，引导立即扫码付款
  payDialog.row = row;
  payDialog.visible = true;
  load();
}

/** 已扫码付款 → 佣金入账，订单完成 */
async function confirmPay() {
  const row = payDialog.row;
  if (!row) return;
  paying.value = true;
  try {
    await request.post(`/pending-payments/${row.id}/pay`);
    ElMessage.success('付款完成，佣金已入账');
    payDialog.visible = false;
    load();
  } finally {
    paying.value = false;
  }
}

async function reject(row) {
  const { value } = await ElMessageBox.prompt('请输入驳回原因', '驳回提现');
  await request.post(`/withdraws/${row.id}/reject`, { reason: value });
  ElMessage.success('已驳回');
  load();
}

onMounted(load);
</script>

<style scoped>
.pager { margin-top: 16px; justify-content: flex-end; }
.pay-box { text-align: center; }
.pay-tip { font-size: 14px; color: #606266; margin-bottom: 12px; }
.pay-qrcode { display: flex; justify-content: center; margin-bottom: 14px; }
.pay-info { text-align: left; }
</style>
