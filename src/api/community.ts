import { apiClient } from './client';
import type { PopcornProgress } from './progress';
import type { MediaType } from '../types/movie';

export interface CommunityStatus { miId: number; normasAceptadas: boolean; versionNormas: string; puedeModerar: boolean; suspendida: boolean }
export interface Person { id: number; username: string; foto: string | null; siguiendo: boolean }
export interface Post {
  mediaType?: MediaType;
  id: number; autorId: number; username: string; tmdbId: number; titulo: string;
  posterPath: string | null; calificacion: number; comentario: string | null; spoiler: boolean; fecha: string | null;
}
export interface PostPage { publicaciones: Post[]; hayMas: boolean }
export interface PublicProfile extends PostPage { persona: Person; progreso?: PopcornProgress }
export type ReportReason = 'ACOSO' | 'CONTENIDO_INAPROPIADO' | 'DATOS_PERSONALES' | 'SPAM' | 'SPOILER' | 'OTRO';
export type ModerationAction = 'OCULTAR_RESENA' | 'MARCAR_SPOILER' | 'QUITAR_FOTO' | 'SUSPENDER' | 'DESESTIMAR';
export interface CommunityReport { id: number; usuarioId: number; username: string; foto: string | null; publicacion: Post | null; motivo: ReportReason; creado: string }

const base = '/api/comunidad';
export const getCommunityStatus = async () => (await apiClient.get<CommunityStatus>(`${base}/estado`)).data;
export const acceptCommunityRules = async (version: string) => { await apiClient.post(`${base}/normas`, { version }); };
export const searchPeople = async (username: string) => (await apiClient.get<Person[]>(`${base}/buscar`, { params: { username } })).data;
export const getFollowingFeed = async (pagina = 0) => (await apiClient.get<PostPage>(`${base}/siguiendo`, { params: { pagina } })).data;
export const getPublicProfile = async (id: number, pagina = 0) => (await apiClient.get<PublicProfile>(`${base}/perfiles/${id}`, { params: { pagina } })).data;
export const setFollowing = async (id: number, following: boolean) => { await apiClient[following ? 'put' : 'delete'](`${base}/siguiendo/${id}`); };
export const getBlockedPeople = async () => (await apiClient.get<Person[]>(`${base}/bloqueados`)).data;
export const setBlocked = async (id: number, blocked: boolean) => { await apiClient[blocked ? 'put' : 'delete'](`${base}/bloqueados/${id}`); };
export const reportContent = async (usuarioId: number, resenaId: number | null, motivo: ReportReason) => { await apiClient.post(`${base}/reportes`, { usuarioId, resenaId, motivo }); };
export const getModerationQueue = async () => (await apiClient.get<CommunityReport[]>(`${base}/moderacion`)).data;
export const resolveReport = async (id: number, accion: ModerationAction) => { await apiClient.put(`${base}/moderacion/${id}`, { accion }); };
