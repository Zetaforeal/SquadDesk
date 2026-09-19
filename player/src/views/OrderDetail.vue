<template>
  <div v-if="order">
    <el-card shadow="never" class="mb">
      <template #header>
        <div class="card-header">
          <span>订单 {{ order.orderNo }}</span>
          <el-tag size="small" :type="tagType(order.dispatchStatus)">{{ order.dispatchText }}</el-tag>
        </div>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="订单金额">{{ order.totalAmount }} 元</el-descriptions-item>
        <el-descriptions-item label="佣金">{{ order.commissionAmount }} 元</el-descriptions-item>
        <el-descriptions-item label="商品">
          <div v-for="it in order.items" :key="it.id">{{ it.product?.name }} x{{ it.quantity }}</div>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ fmt(order.createdAt) }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="never" class="mb" v-if="order.profileData">
      <template #header><span>用户资料</span></template>
      <el-descriptions :column="1" border>
        <el-descriptions-item v-if="order.profileData.platform" label="平台">{{ order.profileData.platform }}</el-descriptions-item>
        <el-descriptions-item v-if="order.profileData.identifier" label="账号">{{ order.profileData.identifier }}</el-descriptions-item>
        <el-descriptions-item v-if="order.profileData.address" label="地址">{{ order.profileData.address }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- 进行中：提交结单 -->
    <el-card shadow="never" class="mb" v-if="order.dispatchStatus === 'IN_PROGRESS'">
      <template #header><span>提交结单</span></template>
      <div class="submit-area">
        <div class="field">
          <div class="label">结单截图（上传或链接）</div>
          <image-input v-model="screenshot" />
        </div>
        <div class="field">
          <div class="label">备注</div>
          <el-input v-model="note" type="textarea" :rows="3" placeholder="完成情况说明（可选）" style="max-width: 480px" />
        </div>
        <el-button type="success" :loading="submitting" @click="submit">提交结单</el-button>
      </div>
    </el-card>

    <!-- 待审核：展示截图 -->
    <el-card shadow="never" class="mb" v-if="order.screenshotPath && order.dispatchStatus !== 'IN_PROGRESS'">
      <template #header><span>结单截图</span></template>
      <el-image :src="order.screenshotPath" style="max-width: 360px" :preview-src-list="[order.screenshotPath]" fit="contain" />
      <div v-if="order.submitNote" class="note">备注：{{ order.submitNote }}</div>
    </el-card>

    <!-- 可提现：申请提现 -->
    <el-card shadow="never" class="mb" v-if="order.dispatchStatus === 'READY_WITHDRAW'">
      <template #header><span>提现</span></template>
      <p>本单佣金 <b class="warn">{{ order.commissionAmount }}</b> 元可申请提现，审核通过后由俱乐部扫码付款。</p>
      <el-button type="primary" :loading="withdrawing" @click="applyWithdraw">申请提现</el-button>
    </el-card>

    <!-- 沟通 -->
    <el-card shadow="never" class="mb">
      <template #header><span>订单沟通</span></template>
      <chat-panel :order-id="order.id" role="player" />
    </el-card>

    <el-button @click="$router.back()">返回</el-button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import request from '@/utils/request';
import ImageInput from '@/components/ImageInput.vue';
import ChatPanel from '@/components/ChatPanel.vue';

const route = useRoute();
const order = ref(null);
const screenshot = ref('');
const note = ref('');
const submitting = ref(false);
const withdrawing = ref(false);

function fmt(t) { return t ? String(t).replace('T', ' ').slice(0, 19) : '-'; }
function tagType(s) {
  return ['COMPLETED', 'READY_WITHDRAW'].includes(s) ? 'success' : ['WITHDRAW_PENDING', 'PENDING_PAYMENT'].includes(s) ? 'warning' : 'primary';
}

async function load() {
  order.value = await request.get(`/orders/${route.params.id}`);
}

async function submit() {
  if (!screenshot.value) return ElMessage.warning('请上传结单截图或填写链接');
  submitting.value = true;
  try {
    await request.post(`/orders/${order.value.id}/submit`, {
      screenshotUrl: screenshot.value,
      note: note.value,
    });
    ElMessage.success('已提交，等待管理员审核');
    load();
  } finally {
    submitting.value = false;
  }
}

async function applyWithdraw() {
  withdrawing.value = true;
  try {
    await request.post(`/withdraw/${order.value.id}/apply`);
    ElMessage.success('提现申请已提交');
    load();
  } finally {
    withdrawing.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.mb { margin-bottom: 16px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.submit-area { display: flex; flex-direction: column; gap: 16px; }
.field .label { font-size: 13px; color: #606266; margin-bottom: 8px; }
.note { margin-top: 8px; font-size: 13px; color: #606266; }
.warn { color: #e6a23c; font-size: 18px; }
</style>
