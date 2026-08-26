import { View, Text, Button, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

export default function HomeScreen() {
  const router = useRouter();

  const handleLogout = async () => {
    // 1. Destruimos el token de la bóveda del dispositivo
    await SecureStore.deleteItemAsync('jwt_token');
    
    // 2. Lo pateamos de vuelta a la pantalla pública
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎬 Catálogo Privado</Text>
      <Text style={styles.subtitle}>¡Ingresaste con éxito a la zona segura!</Text>
      
      <Button 
        title="Cerrar Sesión" 
        color="#d9534f" // Un rojo estilo "peligro" o "salida"
        onPress={handleLogout} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 20 },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#666' }
});