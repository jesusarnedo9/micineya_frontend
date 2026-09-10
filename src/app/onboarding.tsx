import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CatalogOption,
  fetchGenres,
  fetchOnboardingStatus,
  fetchPlatforms,
  saveOnboarding,
} from '../api/onboarding';
import { describeApiError, isAuthError } from '../api/errors';
import { logoutFromServer } from '../api/profile';
import { clearSession } from '../auth/session';
import { AccountSettings } from '../components/profile/account-settings';

function toggleSelection(current: Set<number>, id: number): Set<number> {
  const next = new Set(current);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

interface ChoiceGridProps {
  items: CatalogOption[];
  selected: Set<number>;
  onToggle: (id: number) => void;
}

function ChoiceGrid({ items, selected, onToggle }: ChoiceGridProps) {
  return (
    <View style={styles.choiceGrid}>
      {items.map((item) => {
        const active = selected.has(item.id);
        return (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            key={item.id}
            onPress={() => onToggle(item.id)}
            style={[styles.choice, active && styles.choiceActive]}
          >
            {active ? <Ionicons color="#fff" name="checkmark" size={16} /> : null}
            <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
              {item.nombre}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const [platforms, setPlatforms] = useState<CatalogOption[]>([]);
  const [genres, setGenres] = useState<CatalogOption[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<number>>(new Set());
  const [selectedGenres, setSelectedGenres] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [platformOptions, genreOptions, status] = await Promise.all([
        fetchPlatforms(),
        fetchGenres(),
        fetchOnboardingStatus(),
      ]);
      setPlatforms(platformOptions);
      setGenres(genreOptions);
      setSelectedPlatforms(new Set(status.plataformaIds ?? []));
      setSelectedGenres(new Set(status.generoIds ?? []));
    } catch (error) {
      if (isAuthError(error)) {
        await clearSession();
        router.replace('/(auth)/login');
        return;
      }
      setLoadError(describeApiError(error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    try {
      try {
        await logoutFromServer();
      } catch {
        // Salir del teléfono debe funcionar aunque el servidor esté caído.
      }
      await clearSession();
      router.replace('/(auth)/login');
    } finally {
      setLoggingOut(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert('Cerrar sesión', '¿Querés salir de MiCineYa?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: () => void handleLogout(),
      },
    ]);
  };

  const handleContinue = async () => {
    if (selectedPlatforms.size === 0) {
      Alert.alert('Elegí una plataforma', 'Seleccioná al menos un servicio de streaming.');
      return;
    }
    if (selectedGenres.size === 0) {
      Alert.alert('Elegí un género', 'Seleccioná al menos un género que disfrutes.');
      return;
    }

    setSaving(true);
    try {
      await saveOnboarding([...selectedPlatforms], [...selectedGenres]);
      setShowWelcome(true);
    } catch (error) {
      const failure = describeApiError(error);
      if (failure.requiresLogin) {
        await clearSession();
        router.replace('/(auth)/login');
        return;
      }
      Alert.alert(failure.title, failure.message);
    } finally {
      setSaving(false);
    }
  };

  if (showWelcome) {
    return (
      <SafeAreaView style={styles.welcomeSafeArea}>
        <View style={styles.welcomeContent}>
          <Pressable
            accessibilityRole="button"
            disabled={loggingOut}
            onPress={confirmLogout}
            style={({ pressed }) => [
              styles.welcomeLogoutButton,
              pressed && styles.buttonPressed,
            ]}
          >
            {loggingOut ? (
              <ActivityIndicator color="#ff9ba0" size="small" />
            ) : (
              <Ionicons color="#ff9ba0" name="log-out-outline" size={17} />
            )}
            <Text style={styles.logoutText}>{loggingOut ? 'Saliendo...' : 'Cerrar sesión'}</Text>
          </Pressable>

          <View style={styles.welcomeIconShell}>
            <Ionicons color="#fff" name="sparkles" size={42} />
          </View>

          <Text style={styles.welcomeEyebrow}>TODO LISTO</Text>
          <Text style={styles.welcomeTitle}>Dejá de dar vueltas y disfrutá</Text>
          <Text style={styles.welcomeMessage}>
            En base a tus plataformas y gustos, te recomendamos solo 10 pelis. Si no sabés cuál
            elegir, la ruleta decide por vos.
          </Text>

          <View style={styles.welcomeActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/(app)')}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.primaryButtonText}>Ver mis 10 pelis</Text>
              <Ionicons color="#fff" name="arrow-forward" size={20} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/(app)/roulette')}
              style={({ pressed }) => [styles.rouletteButton, pressed && styles.buttonPressed]}
            >
              <Ionicons color="#ff8f94" name="shuffle" size={20} />
              <Text style={styles.rouletteButtonText}>Probar la ruleta</Text>
            </Pressable>
          </View>

          <Text style={styles.welcomeHint}>
            Podés cambiar tus preferencias cuando quieras desde Mi perfil.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#e50914" size="large" />
        <Text style={styles.loadingText}>Preparando tus preferencias...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Ionicons color="#e50914" name="cloud-offline-outline" size={42} />
        <Text style={styles.errorTitle}>No pudimos cargar las opciones</Text>
        <Text style={styles.errorMessage}>{loadError}</Text>
        <Pressable onPress={() => void loadData()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Reintentar</Text>
        </Pressable>
        <Pressable disabled={loggingOut} onPress={confirmLogout} style={styles.errorLogoutButton}>
          <Ionicons color="#b99ca1" name="log-out-outline" size={17} />
          <Text style={styles.errorLogoutText}>Cerrar sesión</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Text style={styles.topBrand}>MICINEYA</Text>
          <Pressable
            accessibilityRole="button"
            disabled={loggingOut}
            onPress={confirmLogout}
            style={({ pressed }) => [styles.logoutButton, pressed && styles.buttonPressed]}
          >
            {loggingOut ? (
              <ActivityIndicator color="#ff9ba0" size="small" />
            ) : (
              <Ionicons color="#ff9ba0" name="log-out-outline" size={17} />
            )}
            <Text style={styles.logoutText}>{loggingOut ? 'Saliendo...' : 'Cerrar sesión'}</Text>
          </Pressable>
        </View>

        <AccountSettings />
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>PERSONALIZÁ MICINEYA</Text>
          <Text style={styles.title}>Encontrá algo para ver sin dar vueltas</Text>
          <Text style={styles.subtitle}>
            Usamos estas preferencias para elegir tus 10 recomendaciones y alimentar la ruleta.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.step}>01 · TU PAÍS</Text>
          <View style={styles.countryCard}>
            <Text style={styles.flag}>🇦🇷</Text>
            <View style={styles.countryCopy}>
              <Text style={styles.countryName}>Argentina</Text>
              <Text style={styles.countryHint}>Catálogo y disponibilidad local</Text>
            </View>
            <Ionicons color="#5dd39e" name="checkmark-circle" size={24} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.step}>02 · TUS PLATAFORMAS</Text>
          <Text style={styles.sectionTitle}>¿Dónde tenés suscripción?</Text>
          <Text style={styles.sectionHint}>Podés elegir más de una.</Text>
          <ChoiceGrid
            items={platforms}
            onToggle={(id) => setSelectedPlatforms((current) => toggleSelection(current, id))}
            selected={selectedPlatforms}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.step}>03 · TUS GÉNEROS</Text>
          <Text style={styles.sectionTitle}>¿Qué te gusta mirar?</Text>
          <Text style={styles.sectionHint}>Elegí todo lo que te represente.</Text>
          <ChoiceGrid
            items={genres}
            onToggle={(id) => setSelectedGenres((current) => toggleSelection(current, id))}
            selected={selectedGenres}
          />
        </View>

        <Pressable
          disabled={saving}
          onPress={() => void handleContinue()}
          style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>Crear mis recomendaciones</Text>
              <Ionicons color="#fff" name="arrow-forward" size={20} />
            </>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#050505', flex: 1 },
  welcomeSafeArea: { backgroundColor: '#080608', flex: 1 },
  welcomeContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  welcomeLogoutButton: {
    alignItems: 'center',
    borderColor: '#49363b',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 38,
    paddingHorizontal: 12,
    position: 'absolute',
    right: 22,
    top: 18,
  },
  welcomeIconShell: {
    alignItems: 'center',
    backgroundColor: '#b41622',
    borderColor: '#ff6269',
    borderRadius: 43,
    borderWidth: 1,
    height: 86,
    justifyContent: 'center',
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.34,
    shadowRadius: 22,
    width: 86,
  },
  welcomeEyebrow: {
    color: '#ff7379',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.4,
    marginTop: 28,
  },
  welcomeTitle: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 39,
    marginTop: 10,
    maxWidth: 360,
    textAlign: 'center',
  },
  welcomeMessage: {
    color: '#aaa0a3',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
    maxWidth: 360,
    textAlign: 'center',
  },
  welcomeActions: { gap: 12, marginTop: 34, width: '100%' },
  rouletteButton: {
    alignItems: 'center',
    borderColor: '#49363b',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 20,
  },
  rouletteButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  buttonPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  welcomeHint: {
    color: '#6f686a',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 24,
    textAlign: 'center',
  },
  content: { gap: 30, paddingBottom: 44, paddingHorizontal: 22, paddingTop: 22 },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topBrand: {
    color: '#777073',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  logoutButton: {
    alignItems: 'center',
    borderColor: '#49363b',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  logoutText: { color: '#ff9ba0', fontSize: 11, fontWeight: '900' },
  hero: { gap: 12 },
  eyebrow: { color: '#e50914', fontSize: 12, fontWeight: '900', letterSpacing: 1.8 },
  title: { color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -1.1, lineHeight: 39 },
  subtitle: { color: '#aaa', fontSize: 15, lineHeight: 22 },
  section: { gap: 12 },
  step: { color: '#777', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  sectionTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sectionHint: { color: '#8b8b8b', fontSize: 14, marginTop: -6 },
  countryCard: {
    alignItems: 'center',
    backgroundColor: '#141414',
    borderColor: '#2a2a2a',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 16,
  },
  flag: { fontSize: 32, marginRight: 13 },
  countryCopy: { flex: 1, gap: 2 },
  countryName: { color: '#fff', fontSize: 17, fontWeight: '800' },
  countryHint: { color: '#888', fontSize: 12 },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choice: {
    alignItems: 'center',
    backgroundColor: '#151515',
    borderColor: '#303030',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  choiceActive: { backgroundColor: '#b40710', borderColor: '#e50914' },
  choiceText: { color: '#bdbdbd', fontSize: 14, fontWeight: '700' },
  choiceTextActive: { color: '#fff' },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#e50914',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 20,
  },
  primaryButtonDisabled: { opacity: 0.65 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  centered: {
    alignItems: 'center',
    backgroundColor: '#050505',
    flex: 1,
    gap: 14,
    justifyContent: 'center',
    padding: 28,
  },
  loadingText: { color: '#aaa', fontSize: 14 },
  errorTitle: { color: '#fff', fontSize: 21, fontWeight: '900', textAlign: 'center' },
  errorMessage: { color: '#999', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  errorLogoutButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    marginTop: 4,
    padding: 10,
  },
  errorLogoutText: { color: '#b99ca1', fontSize: 13, fontWeight: '800' },
});
