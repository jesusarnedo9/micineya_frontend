import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  clearSession,
  getRefreshToken,
  getToken,
  saveAuthTokens,
} from '../auth/session';

const API_BASE_URL = 'https://micineya.onrender.com';

interface AuthResponse {
  token?: string;
  refreshToken?: string;
}

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const publicAuthPaths = new Set([
  '/api/auth/login',
  '/api/auth/registro',
  '/api/auth/refresh',
]);

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise: Promise<string> | null = null;

async function renewAccessToken(): Promise<string> {
  const currentRefreshToken = await getRefreshToken();
  if (!currentRefreshToken) {
    throw new Error('No hay una sesión renovable guardada');
  }

  const response = await refreshClient.post<AuthResponse>('/api/auth/refresh', {
    refreshToken: currentRefreshToken,
  });
  const accessToken = response.data.token;
  const nextRefreshToken = response.data.refreshToken;

  if (!accessToken || !nextRefreshToken) {
    throw new Error('El servidor no devolvió una sesión válida');
  }

  await saveAuthTokens(accessToken, nextRefreshToken);
  return accessToken;
}

// Interceptor: Atrapa la petición antes de que salga hacia el servidor
apiClient.interceptors.request.use(
  async (config) => {
    if (config.url && publicAuthPaths.has(config.url)) {
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

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    const isAuthFailure = error.response?.status === 401 || error.response?.status === 403;
    const isPublicAuthRequest = originalRequest?.url
      ? publicAuthPaths.has(originalRequest.url)
      : false;

    if (!originalRequest || !isAuthFailure || isPublicAuthRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = renewAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const accessToken = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(originalRequest);
    } catch {
      await clearSession();
      return Promise.reject(error);
    }
  },
);
