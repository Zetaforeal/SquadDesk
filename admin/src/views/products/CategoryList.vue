<template>
  <div>
    <el-card shadow="never">
      <div class="toolbar">
        <el-button type="success" @click="openEdit()">新增分类</el-button>
      </div>
      <el-table :data="rows" v-loading="loading" stripe>
        <el-table-column label="图标" width="80">
          <template #default="{ row }">
            <el-image v-if="row.icon" :src="row.icon" fit="cover" style="width: 40px; height: 40px; border-radius: 8px" />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="分类名称" />
        <el-table-column prop="sortOrder" label="排序" width="80" />
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑分类' : '新增分类'" width="480px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="图标">
          <image-input v-model="form.icon" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
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
import ImageInput from '@/components/ImageInput.vue';

const loading = ref(false);
const rows = ref([]);
const dialogVisible = ref(false);
const saving = ref(false);
const form = reactive({ id: null, name: '', icon: '', sortOrder: 0, enabled: true });

async function load() {
  loading.value = true;
  try {
    rows.value = await request.get('/categories');
  } finally {
    loading.value = false;
  }
}

function openEdit(row) {
  Object.assign(form, row ? { id: row.id, name: row.name, icon: row.icon || '', sortOrder: row.sortOrder, enabled: row.enabled }
    : { id: null, name: '', icon: '', sortOrder: 0, enabled: true });
  dialogVisible.value = true;
}

async function save() {
  if (!form.name) return ElMessage.warning('请输入名称');
  saving.value = true;
  try {
    const payload = { name: form.name, icon: form.icon || null, sortOrder: form.sortOrder, enabled: form.enabled };
    if (form.id) await request.put(`/categories/${form.id}`, payload);
    else await request.post('/categories', payload);
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    load();
  } finally {
    saving.value = false;
  }
}

async function remove(row) {
  await ElMessageBox.confirm(`确定删除分类「${row.name}」？`, '警告', { type: 'warning' });
  await request.delete(`/categories/${row.id}`);
  ElMessage.success('已删除');
  load();
}

onMounted(load);
</script>

<style scoped>
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; }
</style>
