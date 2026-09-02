import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { fetchOnboardingStatus } from '../../api/onboarding';
import { getRememberedLogin, saveSession } from '../../auth/session';

export default function LoginScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getRememberedLogin()
      .then((rememberedLogin) => {
        if (rememberedLogin) {
          setIdentifier(rememberedLogin);
        }
      })
      .catch(() => {
        // Recordar el ingreso es una comodidad; no bloquea el acceso.
      });
  }, []);

  const handleLogin = async () => {
    const normalizedIdentifier = identifier.trim();
    if (!normalizedIdentifier || !password) {
      Alert.alert('Faltan datos', 'Completá tu usuario o correo y la contraseña.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/api/auth/login', {
        identifier: normalizedIdentifier,
        email: normalizedIdentifier,
        password,
      });

      const token = response.data.token;
      if (token) {
        await saveSession(
          token,
          response.data.username || normalizedIdentifier.split('@')[0],
          normalizedIdentifier,
        );
        try {
          const status = await fetchOnboardingStatus();
          router.replace(status.completed ? '/(app)' : '/onboarding');
        } catch {
          router.replace('/(app)');
        }
      }
    } catch (error) {
      const backendMessage = axios.isAxiosError(error)
        && error.response?.data
        && typeof error.response.data.error === 'string'
          ? error.response.data.error
          : 'No pudimos iniciar sesión. Revisá tus datos y la conexión.';
      Alert.alert('No pudimos ingresar', backendMessage);
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
          <View style={styles.brandMark}>
            <View style={styles.brandInner}>
              <Ionicons color="#fff" name="film" size={34} />
            </View>
          </View>
          <Text style={styles.brand}>MICINEYA</Text>
          <Text style={styles.title}>Volvé a tu próxima película</Text>
          <Text style={styles.subtitle}>
            Ingresá tu usuario o correo.
          </Text>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>USUARIO O CORREO</Text>
              <View style={styles.inputShell}>
                <Ionicons color="#8e8588" name="person-outline" size={19} />
                <TextInput
                  autoCapitalize="none"
                  autoComplete="username"
                  editable={!loading}
                  onChangeText={setIdentifier}
                  onSubmitEditing={() => void handleLogin()}
                  placeholder="usuario o correo@ejemplo.com"
                  placeholderTextColor="#625b5d"
                  returnKeyType="next"
                  style={styles.input}
                  value={identifier}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>CONTRASEÑA</Text>
              <View style={styles.inputShell}>
                <Ionicons color="#8e8588" name="lock-closed-outline" size={19} />
                <TextInput
                  autoComplete="current-password"
                  editable={!loading}
                  onChangeText={setPassword}
                  onSubmitEditing={() => void handleLogin()}
                  placeholder="Tu contraseña"
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

            <View style={styles.rememberRow}>
              <Ionicons color="#5dd39e" name="checkmark-circle" size={16} />
              <Text style={styles.rememberText}>Guardar usuario/correo.</Text>
            </View>

            <Pressable
              disabled={loading}
              onPress={() => void handleLogin()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.primaryText}>Ingresar</Text>
                  <Ionicons color="#fff" name="arrow-forward" size={19} />
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>¿PRIMERA VEZ?</Text>
            <View style={styles.divider} />
          </View>

          <Pressable
            disabled={loading}
            onPress={() => router.push('/(auth)/register')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Ionicons color="#ff7379" name="person-add-outline" size={19} />
            <Text style={styles.secondaryText}>Crear una cuenta</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    justifyContent: 'center',
    paddingBottom: 34,
    paddingHorizontal: 24,
    paddingTop: 26,
  },
  brandMark: {
    alignItems: 'center',
    alignSelf: 'center',
    borderColor: '#ff5961',
    borderRadius: 39,
    borderWidth: 1,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },
  brandInner: {
    alignItems: 'center',
    backgroundColor: '#d91522',
    borderRadius: 31,
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
  brand: {
    color: '#ff7379',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: 15,
    textAlign: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 36,
    marginTop: 10,
    textAlign: 'center',
  },
  subtitle: {
    alignSelf: 'center',
    color: '#978e91',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    maxWidth: 340,
    textAlign: 'center',
  },
  form: {
    gap: 17,
    marginTop: 30,
  },
  fieldGroup: {
    gap: 7,
  },
  label: {
    color: '#a79da0',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
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
    minHeight: 56,
    paddingHorizontal: 15,
  },
  input: {
    color: '#fff',
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  rememberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    marginTop: -4,
  },
  rememberText: {
    color: '#777073',
    fontSize: 11,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#d91522',
    borderRadius: 17,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
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
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginVertical: 25,
  },
  divider: {
    backgroundColor: '#2c2729',
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: '#625b5d',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#3b3033',
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    minHeight: 54,
  },
  secondaryText: {
    color: '#f0e9eb',
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
