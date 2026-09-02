import axios from 'axios';
import { getToken } from '../auth/session';

export const apiClient = axios.create({
  baseURL: 'https://micineya.onrender.com',
  timeout: 120_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: Atrapa la petición antes de que salga hacia el servidor
apiClient.interceptors.request.use(
  async (config) => {
    if (config.url === '/api/auth/login' || config.url === '/api/auth/registro') {
      return config;
    }

    // Buscamos el token en la bóveda segura
    const token = await getToken();
    
    if (token) {
      // Si existe, lo inyectamos con el formato estándar "Bearer"
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
