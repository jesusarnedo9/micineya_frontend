import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { describeApiError } from '../../api/errors';
import { removeProfilePhoto, saveProfilePhoto } from '../../api/profile';
import { useAppExperience } from '../../context/app-experience';
import { ProfileAvatar } from './profile-avatar';
import { ensureCommunityParticipation } from '../community/community-rules';

export function ProfilePhotoPicker() {
  const { photoUri, username, setProfilePhoto } = useAppExperience();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const change = async (remove = false) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (remove) {
        await removeProfilePhoto();
        setProfilePhoto(null);
        return;
      }
      if (!await ensureCommunityParticipation()) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const side = Math.min(asset.width, asset.height);
      const context = ImageManipulator.manipulate(asset.uri);
      try {
        context.crop({ originX: Math.floor((asset.width - side) / 2), originY: Math.floor((asset.height - side) / 2), width: side, height: side });
        context.resize({ width: 256, height: 256 });
        const image = await context.renderAsync();
        try {
          const compressed = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.65, base64: true });
          if (!compressed.base64 || compressed.base64.length > 87380) {
            Alert.alert('Elegí otra foto', 'No pudimos reducir esta imagen al tamaño permitido.');
            return;
          }
          setProfilePhoto(await saveProfilePhoto(compressed.base64));
        } finally {
          image.release();
        }
      } finally {
        context.release();
      }
    } catch (error) {
      const failure = describeApiError(error);
      Alert.alert('No se pudo actualizar la foto', failure.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const showOptions = () => Alert.alert('Tu foto de perfil', 'Elegí una foto. La vamos a comprimir automáticamente.', [
    { text: 'Cancelar', style: 'cancel' },
    ...(photoUri ? [{ text: 'Quitar foto', style: 'destructive' as const, onPress: () => void change(true) }] : []),
    { text: 'Elegir foto', onPress: () => void change() },
  ]);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Cambiar foto de perfil" disabled={busy} onPress={showOptions} style={styles.button}>
      <View style={styles.ring}>
        <ProfileAvatar uri={photoUri} username={username} />
        <View style={styles.edit}>
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="pencil" size={13} color="#fff" />}
        </View>
      </View>
      <Text style={styles.label}>{busy ? 'Guardando...' : 'Editar foto'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', gap: 5 },
  ring: { borderWidth: 1, borderColor: '#ff626a', borderRadius: 38, width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  edit: { position: 'absolute', bottom: -1, right: -1, borderRadius: 12, backgroundColor: '#a51a27', width: 25, height: 25, alignItems: 'center', justifyContent: 'center' },
  label: { color: '#ff9ba0', fontSize: 10, fontWeight: '700' },
});
