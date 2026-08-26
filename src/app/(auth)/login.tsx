import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { apiClient } from '../../api/client';
import * as SecureStore from 'expo-secure-store';

export default function LoginScreen() {
  const router = useRouter();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false); // Estado para mostrar la ruedita de carga

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Completá todos los campos');
      return;
    }

    setCargando(true); // Arrancamos a cargar

    try {
      // 1. Disparamos la petición POST al endpoint de Spring Boot
      const response = await apiClient.post('/api/auth/login', {
        username: username,
        password: password
      });
      
      // 2. Capturamos el token de tu AuthResponse
      // (Asumo que el campo se llama 'token', si se llama distinto en Java avisame)
      const token = response.data.token;
      
      if (token) {
        // 3. Guardamos el token en la bóveda encriptada del celular
        await SecureStore.setItemAsync('jwt_token', token);
        
        // 4. Usamos replace en vez de push para que no pueda volver al Login con la flechita atrás
        router.replace('/(app)');
      }
      
    } catch (error) {
      // Si el servidor tira un 403 Forbidden o 401 Unauthorized, caemos acá
      Alert.alert('Error', 'Usuario o contraseña incorrectos');
      console.error(error);
    } finally {
      setCargando(false); // Apagamos la ruedita pase lo que pase
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Iniciar Sesión en MiCineYa</Text>
      
      <TextInput 
        style={styles.input}
        placeholder="Usuario"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      
      <TextInput 
        style={styles.input}
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      {/* Si está cargando mostramos el indicador, si no, mostramos el botón */}
      {cargando ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <Button title="Ingresar" onPress={handleLogin} />
      )}
      
      <View style={styles.spacer} />
      
      <Button 
        title="Crear una cuenta nueva" 
        color="#888"
        onPress={() => router.push('/(auth)/register')} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, gap: 15 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5, fontSize: 16 },
  spacer: { marginTop: 20 }
});