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
import { describeApiError } from '../api/errors';

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
  const [loadError, setLoadError] = useState<string | null>(null);

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
      setLoadError(describeApiError(error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

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
      router.replace('/(app)');
    } catch (error) {
      const failure = describeApiError(error);
      Alert.alert(failure.title, failure.message);
    } finally {
      setSaving(false);
    }
  };

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
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
  content: { gap: 30, paddingBottom: 44, paddingHorizontal: 22, paddingTop: 22 },
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
});
