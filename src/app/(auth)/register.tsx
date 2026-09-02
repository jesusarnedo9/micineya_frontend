import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiClient } from '../../api/client';
import { saveSession } from '../../auth/session';

export default function RegisterScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedConfirmation = confirmEmail.trim().toLowerCase();

    if (!normalizedUsername || !normalizedEmail || !normalizedConfirmation || !password) {
      Alert.alert('Faltan datos', 'Completá todos los campos.');
      return;
    }
    if (normalizedUsername.length < 3 || normalizedUsername.length > 30) {
      Alert.alert('Usuario inválido', 'Debe tener entre 3 y 30 caracteres.');
      return;
    }
    if (!normalizedEmail.includes('@') || !normalizedEmail.includes('.')) {
      Alert.alert('Correo inválido', 'Ingresá un correo electrónico válido.');
      return;
    }
    if (normalizedEmail !== normalizedConfirmation) {
      Alert.alert('Los correos no coinciden', 'Revisá la confirmación del correo.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Contraseña muy corta', 'Debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/api/auth/registro', {
        username: normalizedUsername,
        email: normalizedEmail,
        password,
      });

      const token = response.data.token;
      if (token) {
        await saveSession(
          token,
          response.data.username || normalizedUsername,
          normalizedEmail,
        );
        router.replace('/onboarding');
      } else {
        Alert.alert('Cuenta creada', 'Ya podés iniciar sesión.');
        router.replace('/(auth)/login');
      }
    } catch (error) {
      const backendMessage = axios.isAxiosError(error)
        && error.response?.data
        && typeof error.response.data.error === 'string'
          ? error.response.data.error
          : 'No se pudo crear la cuenta. Revisá la conexión e intentá nuevamente.';
      Alert.alert('No pudimos registrarte', backendMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            accessibilityLabel="Volver"
            hitSlop={10}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons color="#fff" name="arrow-back" size={22} />
          </Pressable>

          <Text style={styles.eyebrow}>TU CUENTA</Text>
          <Text style={styles.title}>Creá tu identidad cinéfila</Text>
          <Text style={styles.subtitle}>
            Tus preferencias, guardadas y reseñas van a vivir en un mismo lugar.
          </Text>

          <View style={styles.form}>
            <AuthField
              autoComplete="username-new"
              icon="person-outline"
              label="NOMBRE DE USUARIO"
              onChangeText={setUsername}
              placeholder="cinefilo_23"
              value={username}
            />
            <AuthField
              autoComplete="email"
              icon="mail-outline"
              keyboardType="email-address"
              label="CORREO"
              onChangeText={setEmail}
              placeholder="correo@ejemplo.com"
              value={email}
            />
            <AuthField
              autoComplete="email"
              icon="checkmark-circle-outline"
              keyboardType="email-address"
              label="CONFIRMAR CORREO"
              onChangeText={setConfirmEmail}
              placeholder="Repetí tu correo"
              value={confirmEmail}
            />

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>CONTRASEÑA</Text>
              <View style={styles.inputShell}>
                <Ionicons color="#8e8588" name="lock-closed-outline" size={19} />
                <TextInput
                  autoComplete="new-password"
                  editable={!loading}
                  onChangeText={setPassword}
                  onSubmitEditing={() => void handleRegister()}
                  placeholder="Mínimo 8 caracteres"
                  placeholderTextColor="#625b5d"
                  returnKeyType="done"
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  value={password}
                />
                <Pressable
                  accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  hitSlop={10}
                  onPress={() => setShowPassword((current) => !current)}
                >
                  <Ionicons
                    color="#8e8588"
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                  />
                </Pressable>
              </View>
            </View>

            <Pressable
              disabled={loading}
              onPress={() => void handleRegister()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.primaryText}>Crear mi cuenta</Text>
                  <Ionicons color="#fff" name="arrow-forward" size={19} />
                </>
              )}
            </Pressable>
          </View>

          <Pressable
            disabled={loading}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.loginLink, pressed && styles.pressed]}
          >
            <Text style={styles.loginHint}>¿Ya tenés cuenta?</Text>
            <Text style={styles.loginText}> Ingresá</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface AuthFieldProps {
  autoComplete: 'email' | 'username-new';
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: 'default' | 'email-address';
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}

function AuthField({
  autoComplete,
  icon,
  keyboardType = 'default',
  label,
  onChangeText,
  placeholder,
  value,
}: AuthFieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <Ionicons color="#8e8588" name={icon} size={19} />
        <TextInput
          autoCapitalize="none"
          autoComplete={autoComplete}
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#625b5d"
          style={styles.input}
          value={value}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#080608',
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 36,
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#191416',
    borderColor: '#342d30',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  eyebrow: {
    color: '#ff7379',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.2,
    marginTop: 28,
  },
  title: {
    color: '#fff',
    fontSize: 33,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 38,
    marginTop: 8,
  },
  subtitle: {
    color: '#978e91',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
  },
  form: {
    gap: 16,
    marginTop: 27,
  },
  fieldGroup: {
    gap: 7,
  },
  label: {
    color: '#a79da0',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.35,
    marginLeft: 3,
  },
  inputShell: {
    alignItems: 'center',
    backgroundColor: '#151214',
    borderColor: '#342d30',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 15,
  },
  input: {
    color: '#fff',
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#d91522',
    borderRadius: 17,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 56,
    shadowColor: '#d91522',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  loginLink: {
    alignSelf: 'center',
    flexDirection: 'row',
    marginTop: 25,
    padding: 8,
  },
  loginHint: {
    color: '#777073',
    fontSize: 13,
  },
  loginText: {
    color: '#ff7379',
    fontSize: 13,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
