import axios from 'axios';
import { ElMessage } from 'element-plus';

const request = axios.create({ baseURL: '/api/player', timeout: 15000 });

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('player_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const tenantId = localStorage.getItem('player_tenantId');
  if (tenantId) config.headers['X-Tenant-Id'] = tenantId;
  return config;
});

request.interceptors.response.use(
  (res) => {
    const body = res.data;
    if (body.code === 0) return body.data;
    if (body.code === 401) {
      localStorage.removeItem('player_token');
      localStorage.removeItem('player_tenantId');
      window.location.href = '/player/login';
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
