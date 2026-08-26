import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { apiClient } from '../../api/client';
import * as SecureStore from 'expo-secure-store';

export default function RegisterScreen() {
  const router = useRouter();
  
  // Agregamos el estado para el email, sumado a usuario y contraseña
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleRegister = async () => {
    // 1. Validaciones Frontend (Espejo de tus anotaciones en Spring Boot)
    if (!username || !email || !password) {
      Alert.alert('Error', 'Todos los campos son obligatorios');
      return;
    }
    if (username.length < 3 || username.length > 30) {
      Alert.alert('Error', 'El usuario debe tener entre 3 y 30 caracteres');
      return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      Alert.alert('Error', 'Ingresá un correo electrónico válido');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setCargando(true);

    try {
      // 2. Petición POST al endpoint de registro
      const response = await apiClient.post('/api/auth/registro', {
        username: username,
        email: email,
        password: password
      });
      
      // 3. Manejo de la respuesta
      // Si tu backend devuelve un token automáticamente al registrarse, entramos al Home
      const token = response.data.token;
      
      if (token) {
        await SecureStore.setItemAsync('jwt_token', token);
        router.replace('/(app)');
      } else {
        // Si no devuelve token, lo mandamos al Login para que ingrese manualmente
        Alert.alert('¡Éxito!', 'Cuenta creada correctamente. Por favor, iniciá sesión.');
        router.replace('/(auth)/login');
      }
      
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear la cuenta. Es posible que el usuario o el email ya existan.');
      console.error(error);
    } finally {
      setCargando(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear Cuenta</Text>
      
      <TextInput 
        style={styles.input}
        placeholder="Nombre de Usuario (ej: cinefila_user)"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      <TextInput 
        style={styles.input}
        placeholder="Correo Electrónico"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      
      <TextInput 
        style={styles.input}
        placeholder="Contraseña (mínimo 8 caracteres)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      {cargando ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <Button title="Registrarme" onPress={handleRegister} />
      )}
      
      <View style={styles.spacer} />
      
      {/* Botón para volver al login si el usuario se arrepiente */}
      <Button 
        title="Volver al Login" 
        color="#888"
        onPress={() => router.back()} 
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