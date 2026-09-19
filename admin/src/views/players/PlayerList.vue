<template>
  <div>
    <el-card shadow="never">
      <div class="toolbar">
        <el-select v-model="query.status" placeholder="状态" clearable style="width: 130px" @change="load">
          <el-option label="启用" value="active" />
          <el-option label="禁用" value="disabled" />
        </el-select>
        <el-button type="success" @click="openEdit()">新增打手</el-button>
      </div>

      <el-table :data="rows" v-loading="loading" stripe>
        <el-table-column prop="nickname" label="昵称" width="120" />
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
              {{ row.status === 'active' ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="在线" width="90">
          <template #default="{ row }">
            <el-tag :type="row.online ? 'primary' : 'info'" size="small">{{ row.online ? '在线' : '下线' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="累计佣金" width="110">
          <template #default="{ row }">{{ row.totalCommission }} 元</template>
        </el-table-column>
        <el-table-column label="接单数" width="90">
          <template #default="{ row }">{{ row._count?.orders || 0 }}</template>
        </el-table-column>
        <el-table-column label="收款码" width="110">
          <template #default="{ row }">
            <el-image v-if="row.qrcodePath" :src="row.qrcodePath" fit="cover" style="width: 40px; height: 40px; border-radius: 6px" :preview-src-list="[row.qrcodePath]" />
            <el-tag v-else size="small" type="warning">未上传</el-tag>
            <div class="qr-tip">打手自行上传</div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link :type="row.status === 'active' ? 'danger' : 'success'" @click="toggleStatus(row)">
              {{ row.status === 'active' ? '禁用' : '启用' }}
            </el-button>
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

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑打手' : '新增打手'" width="480px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="用户名" required>
          <el-input v-model="form.username" :disabled="!!form.id" />
        </el-form-item>
        <el-form-item label="昵称" required>
          <el-input v-model="form.nickname" />
        </el-form-item>
        <el-form-item label="密码" :required="!form.id">
          <el-input v-model="form.password" type="password" show-password :placeholder="form.id ? '留空则不修改' : '初始密码'" />
        </el-form-item>
        <el-alert type="info" :closable="false" title="收款码由打手本人在打手端「个人中心」上传，结算付款时使用" />
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/utils/request';

const loading = ref(false);
const rows = ref([]);
const total = ref(0);
const dialogVisible = ref(false);
const saving = ref(false);
const query = reactive({ page: 1, pageSize: 20, status: '' });
const form = reactive({ id: null, username: '', nickname: '', password: '' });

async function load() {
  loading.value = true;
  try {
    const data = await request.get('/players', { params: query });
    rows.value = data.list;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function openEdit(row) {
  Object.assign(form, row ? { id: row.id, username: row.username, nickname: row.nickname, password: '' }
    : { id: null, username: '', nickname: '', password: '' });
  dialogVisible.value = true;
}

async function save() {
  if (!form.username || !form.nickname || (!form.id && !form.password)) {
    return ElMessage.warning('请填写完整信息');
  }
  if (form.password && form.password.length < 12) return ElMessage.warning('密码至少 12 位');
  saving.value = true;
  try {
    const payload = { nickname: form.nickname };
    if (form.password) payload.password = form.password;
    if (form.id) await request.put(`/players/${form.id}`, payload);
    else await request.post('/players', { username: form.username, ...payload });
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    load();
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(row) {
  const next = row.status === 'active' ? 'disabled' : 'active';
  await request.put(`/players/${row.id}`, { status: next });
  ElMessage.success(next === 'disabled' ? '已禁用' : '已启用');
  load();
}

onMounted(load);
</script>

<style scoped>
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; }
.pager { margin-top: 16px; justify-content: flex-end; }
.qr-tip { font-size: 11px; color: #c0c4cc; margin-top: 2px; }
</style>
