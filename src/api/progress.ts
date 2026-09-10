import { apiClient } from './client';

export interface PopcornProgress {
  usuarioId: number;
  peliculasVistas: number;
  seriesVistas?: number;
  temporadasVistas?: number;
  totalPochoclos?: number;
  capacidadBalde: number;
  baldesCompletos: number;
  pochoclosEnBalde: number;
  numeroBalde: number;
}

export async function fetchPopcornProgress(): Promise<PopcornProgress> {
  return (await apiClient.get<PopcornProgress>('/api/biblioteca/progreso')).data;
}
