import { Alert } from 'react-native';
import { acceptCommunityRules, getCommunityStatus } from '../../api/community';

export const COMMUNITY_RULES_VERSION = '2026-09-10';

export const COMMUNITY_RULES = 'Tu nombre de usuario, foto, películas y series vistas, puntuaciones y reseñas (también las anteriores) serán visibles para otras personas de MiCineYa. Tus guardadas, correo y preferencias son privados. No se muestran tus listas de seguidores ni seguidos.\n\nNo publiques acoso, amenazas, odio, contenido sexual explícito, spam ni datos personales ajenos. Marcá los spoilers. Podés reportar y bloquear; el contenido que incumpla estas normas puede ocultarse y la participación en Comunidad puede suspenderse.';

// Sin caché global: la aceptación siempre pertenece a la cuenta actualmente autenticada.
export async function ensureCommunityParticipation(): Promise<boolean> {
  const status = await getCommunityStatus();
  if (status.versionNormas !== COMMUNITY_RULES_VERSION) {
    Alert.alert('Actualizá MiCineYa', 'Hay una nueva versión de las normas de Comunidad. Actualizá la app antes de compartir.');
    return false;
  }
  if (status.suspendida) {
    Alert.alert('Comunidad suspendida', 'Podés seguir usando tu biblioteca personal, pero no compartir contenido en Comunidad.');
    return false;
  }
  if (status.normasAceptadas) return true;
  const accepted = await new Promise<boolean>((resolve) => Alert.alert('Antes de compartir', COMMUNITY_RULES, [
    { text: 'Ahora no', style: 'cancel', onPress: () => resolve(false) },
    { text: 'Aceptar y participar', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
  if (accepted) await acceptCommunityRules(status.versionNormas);
  return accepted;
}
