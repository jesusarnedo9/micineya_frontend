import axios from 'axios';

// Creamos una instancia configurada con tu servidor en Render
export const apiClient = axios.create({
  baseURL: 'https://micineya.onrender.com', // El dominio de tu backend
  headers: {
    'Content-Type': 'application/json',
  },
});