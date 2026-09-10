import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { changePassword, deleteAccount } from '../../api/profile';
import { describeApiError } from '../../api/errors';
import { clearSession, forgetLogin, getAccountStorageAliases } from '../../auth/session';
import { clearProfileReviews } from '../../profile/review-storage';

type Action = 'password' | 'delete';

export function AccountSettings() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const deleting = action === 'delete';
  const valid = current.length > 0 && (deleting
    ? confirmation === 'ELIMINAR' : next.length >= 8 && next === confirmation);

  const close = () => {
    if (busyRef.current) return;
    setAction(null);
    setCurrent('');
    setNext('');
    setConfirmation('');
    setError('');
  };

  const submit = async () => {
    if (!action || !valid || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      // Leer las claves antes de que el backend invalide la sesión.
      const aliases = deleting ? await getAccountStorageAliases() : [];
      if (deleting) await deleteAccount(current);
      else await changePassword(current, next);

      const cleanup = await Promise.allSettled([
        clearSession(),
        ...(deleting ? [forgetLogin(), ...aliases.map(clearProfileReviews)] : []),
      ]);
      setAction(null);
      setCurrent('');
      setNext('');
      setConfirmation('');
      router.replace('/(auth)/login');
      if (cleanup.some((result) => result.status === 'rejected')) {
        Alert.alert(deleting ? 'Cuenta eliminada' : 'Contraseña actualizada',
          'No pudimos limpiar todos los datos de este teléfono. Borrá los datos de MiCineYa desde Ajustes de Android.');
      } else {
        Alert.alert(deleting ? 'Cuenta eliminada' : 'Contraseña actualizada', deleting
          ? 'Eliminamos tu cuenta y sus datos del servicio.'
          : 'Cerramos tus sesiones. Volvé a ingresar con tu nueva contraseña.');
      }
    } catch (failure) {
      setError(describeApiError(failure).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={styles.panel}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.row}>
        <Ionicons name="shield-checkmark-outline" size={20} color="#ff9ba0" />
        <Text style={styles.heading}>Tu cuenta</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#aaa" />
      </Pressable>
      {expanded ? (
        <View>
          <Pressable accessibilityRole="button" onPress={() => setAction('password')} style={styles.row}>
            <Ionicons name="key-outline" size={18} color="#ddd" /><Text style={styles.option}>Cambiar contraseña</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setAction('delete')} style={styles.row}>
            <Ionicons name="trash-outline" size={18} color="#ff9299" /><Text style={styles.danger}>Eliminar cuenta</Text>
          </Pressable>
        </View>
      ) : null}
      <Modal visible={action !== null} transparent animationType="slide" onRequestClose={close}>
        <SafeAreaView style={styles.backdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScroll}>
              <View style={styles.sheet}>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>{deleting ? 'Eliminar cuenta' : 'Cambiar contraseña'}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" disabled={busy} onPress={close} style={styles.close}>
                    <Ionicons name="close" size={24} color="#ccc" />
                  </Pressable>
                </View>
                <Text style={styles.description}>{deleting
                  ? 'Se borrarán tu perfil, foto, preferencias, guardadas, puntuaciones, reseñas e historial de recomendaciones. Esta acción no se puede deshacer.'
                  : 'Para proteger tu cuenta, vamos a cerrar las sesiones abiertas. Después ingresá con tu nueva contraseña.'}</Text>
                <Text style={styles.label}>Contraseña actual</Text>
                <TextInput accessibilityLabel="Contraseña actual" autoCapitalize="none" autoCorrect={false} secureTextEntry
                  autoComplete="current-password" editable={!busy} maxLength={128} value={current} onChangeText={setCurrent} style={styles.input} />
                {!deleting ? (
                  <>
                    <Text style={styles.label}>Nueva contraseña · mínimo 8 caracteres</Text>
                    <TextInput accessibilityLabel="Nueva contraseña" autoCapitalize="none" autoCorrect={false} secureTextEntry
                      autoComplete="new-password" editable={!busy} maxLength={72} value={next} onChangeText={setNext} style={styles.input} />
                  </>
                ) : null}
                <Text style={styles.label}>{deleting ? 'Escribí ELIMINAR para confirmar' : 'Repetí la nueva contraseña'}</Text>
                <TextInput accessibilityLabel={deleting ? 'Confirmar eliminación' : 'Confirmar nueva contraseña'}
                  autoCapitalize="none" autoCorrect={false} secureTextEntry={!deleting} editable={!busy}
                  maxLength={72} value={confirmation} onChangeText={setConfirmation} style={styles.input} />
                {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
                <Pressable accessibilityRole="button" disabled={busy || !valid} onPress={() => void submit()}
                  style={[styles.submit, (busy || !valid) && styles.disabled]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>
                    {deleting ? 'Eliminar mi cuenta definitivamente' : 'Guardar contraseña'}
                  </Text>}
                </Pressable>
                <Pressable accessibilityRole="button" disabled={busy} onPress={close} style={styles.cancel}>
                  <Text style={styles.option}>Cancelar</Text>
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginHorizontal: 18, marginTop: 16, backgroundColor: '#121012', borderColor: '#33272d', borderWidth: 1, borderRadius: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 16, paddingVertical: 12 },
  heading: { color: '#fff', fontSize: 15, fontWeight: '800', flex: 1 },
  option: { color: '#ddd', fontSize: 14 },
  danger: { color: '#ff9299', fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)' },
  keyboard: { flex: 1 },
  modalScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#171214', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', flex: 1 },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  description: { color: '#b6abad', fontSize: 14, lineHeight: 21, marginVertical: 14 },
  label: { color: '#e0d9db', fontSize: 13, marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: '#242023', color: '#fff', borderWidth: 1, borderColor: '#494045', borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  error: { color: '#ff9ba0', fontSize: 13, marginTop: 14 },
  submit: { backgroundColor: '#aa1826', borderRadius: 16, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 24, padding: 12 },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  disabled: { opacity: 0.5 },
  cancel: { alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: 6 },
});
