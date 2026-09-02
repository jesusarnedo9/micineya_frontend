import axios from 'axios';

export interface ApiFailure {
  title: string;
  message: string;
  requiresLogin: boolean;
}

export function isAuthError(error: unknown): boolean {
  return axios.isAxiosError(error)
    && (error.response?.status === 401 || error.response?.status === 403);
}

export function describeApiError(error: unknown): ApiFailure {
  if (!axios.isAxiosError(error)) {
    return {
      title: 'Algo salió mal',
      message: 'Ocurrió un error inesperado. Intentá nuevamente.',
      requiresLogin: false,
    };
  }

  if (error.response?.status === 401 || error.response?.status === 403) {
    return {
      title: 'Tu sesión venció',
      message: 'Volvé a iniciar sesión para seguir viendo películas.',
      requiresLogin: true,
    };
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return {
      title: 'Render sigue despertando',
      message: 'El servidor tardó demasiado en responder. Esperá unos segundos y reintentá.',
      requiresLogin: false,
    };
  }

  if (!error.response) {
    return {
      title: 'Sin conexión con MiCineYa',
      message: 'Revisá tu conexión a internet o volvé a intentar cuando el servidor esté disponible.',
      requiresLogin: false,
    };
  }

  const backendMessage = error.response.data
    && typeof error.response.data === 'object'
    && 'error' in error.response.data
    && typeof error.response.data.error === 'string'
      ? error.response.data.error
      : null;

  return {
    title: 'El servidor tuvo un problema',
    message: backendMessage ?? 'No pudimos obtener las películas en este momento.',
    requiresLogin: false,
  };
}

