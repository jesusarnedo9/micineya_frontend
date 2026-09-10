import { Image, Text, View } from 'react-native';

export function ProfileAvatar({ uri, username, size = 62 }: { uri: string | null; username: string; size?: number }) {
  const shape = { width: size, height: size, borderRadius: size / 2 };
  return uri ? <Image accessibilityLabel="Foto de perfil" source={{ uri }} style={shape} /> : (
    <View style={[shape, { backgroundColor: '#a51a27', alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: '#fff', fontSize: size * 0.45, fontWeight: '900' }}>{username.charAt(0).toUpperCase()}</Text>
    </View>
  );
}
