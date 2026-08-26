import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const apiClient = axios.create({
  baseURL: 'https://micineya.onrender.com',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: Atrapa la petición antes de que salga hacia el servidor
apiClient.interceptors.request.use(
  async (config) => {
    // Buscamos el token en la bóveda segura
    const token = await SecureStore.getItemAsync('jwt_token');
    
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