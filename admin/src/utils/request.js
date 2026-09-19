import axios from 'axios';
import { ElMessage } from 'element-plus';

const request = axios.create({ baseURL: '/api/admin', timeout: 15000 });

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const tenantId = localStorage.getItem('admin_tenantId');
  if (tenantId) config.headers['X-Tenant-Id'] = tenantId;
  return config;
});

request.interceptors.response.use(
  (res) => {
    const body = res.data;
    if (body.code === 0) return body.data;
    if (body.code === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_tenantId');
      window.location.href = '/admin/login';
    }
    ElMessage.error(body.message || '请求失败');
    return Promise.reject(body);
  },
  (err) => {
    ElMessage.error(err.message || '网络错误');
    return Promise.reject(err);
  }
);

export default request;
