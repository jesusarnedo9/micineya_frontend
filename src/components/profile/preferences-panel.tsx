import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { describeApiError } from '../../api/errors';
import {
  type CatalogOption,
  fetchGenres,
  fetchOnboardingStatus,
  fetchPlatforms,
  saveOnboarding,
} from '../../api/onboarding';

interface PreferencesPanelProps {
  onSaved: () => void;
}

function toggleSelection(current: Set<number>, id: number): Set<number> {
  const next = new Set(current);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

function selectedNames(options: CatalogOption[], selected: Set<number>): string[] {
  return options.filter((option) => selected.has(option.id)).map((option) => option.nombre);
}

function PreferenceChips({ names, emptyText }: { names: string[]; emptyText: string }) {
  if (names.length === 0) {
    return <Text style={styles.emptyPreference}>{emptyText}</Text>;
  }

  return (
    <View style={styles.chips}>
      {names.map((name) => (
        <View key={name} style={styles.summaryChip}>
          <Text style={styles.summaryChipText}>{name}</Text>
        </View>
      ))}
    </View>
  );
}

function ChoiceGrid({
  items,
  selected,
  onToggle,
}: {
  items: CatalogOption[];
  selected: Set<number>;
  onToggle: (id: number) => void;
}) {
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
            style={({ pressed }) => [
              styles.choice,
              active && styles.choiceActive,
              pressed && styles.pressed,
            ]}
          >
            {active ? <Ionicons color="#fff" name="checkmark" size={15} /> : null}
            <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
              {item.nombre}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PreferencesPanel({ onSaved }: PreferencesPanelProps) {
  const [platforms, setPlatforms] = useState<CatalogOption[]>([]);
  const [genres, setGenres] = useState<CatalogOption[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<number>>(new Set());
  const [selectedGenres, setSelectedGenres] = useState<Set<number>>(new Set());
  const [savedPlatforms, setSavedPlatforms] = useState<Set<number>>(new Set());
  const [savedGenres, setSavedGenres] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [platformOptions, genreOptions, status] = await Promise.all([
        fetchPlatforms(),
        fetchGenres(),
        fetchOnboardingStatus(),
      ]);
      setPlatforms(platformOptions);
      setGenres(genreOptions);
      const nextPlatforms = new Set(status.plataformaIds ?? []);
      const nextGenres = new Set(status.generoIds ?? []);
      setSelectedPlatforms(nextPlatforms);
      setSelectedGenres(nextGenres);
      setSavedPlatforms(nextPlatforms);
      setSavedGenres(nextGenres);
    } catch (error) {
      setErrorMessage(describeApiError(error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const openEditor = () => {
    setSelectedPlatforms(new Set(savedPlatforms));
    setSelectedGenres(new Set(savedGenres));
    setEditing(true);
  };

  const closeEditor = () => {
    if (saving) {
      return;
    }
    setSelectedPlatforms(new Set(savedPlatforms));
    setSelectedGenres(new Set(savedGenres));
    setEditing(false);
  };

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  const handleSave = async () => {
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
      setSavedPlatforms(new Set(selectedPlatforms));
      setSavedGenres(new Set(selectedGenres));
      onSaved();
      setEditing(false);
    } catch (error) {
      const failure = describeApiError(error);
      Alert.alert(failure.title, failure.message);
    } finally {
      setSaving(false);
    }
  };

  const platformNames = selectedNames(platforms, savedPlatforms);
  const genreNames = selectedNames(genres, savedGenres);
  const preferenceSummary = loading
    ? 'Cargando...'
    : errorMessage
      ? 'No disponible'
      : `${savedPlatforms.size} plataformas · ${savedGenres.size} géneros`;

  return (
    <>
      <View style={styles.card}>
        <Pressable
          accessibilityLabel={expanded ? 'Cerrar preferencias' : 'Ver preferencias'}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((current) => !current)}
          style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
        >
          <View style={styles.headerIcon}>
            <Ionicons color="#ff7b80" name="options-outline" size={21} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>TUS PREFERENCIAS</Text>
            <Text style={styles.title}>{preferenceSummary}</Text>
          </View>
          <Ionicons
            color="#9b8f92"
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
          />
        </Pressable>

        {expanded ? (
          <View style={styles.expandedContent}>
            {loading ? (
              <View style={styles.statusRow}>
                <ActivityIndicator color="#ff7379" size="small" />
                <Text style={styles.statusText}>Cargando preferencias...</Text>
              </View>
            ) : errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <Pressable onPress={() => void loadPreferences()}>
                  <Text style={styles.retryText}>Reintentar</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.groupLabel}>PLATAFORMAS</Text>
                <PreferenceChips names={platformNames} emptyText="Sin plataformas elegidas" />
                <Text style={styles.groupLabel}>GÉNEROS</Text>
                <PreferenceChips names={genreNames} emptyText="Sin géneros elegidos" />
                <Pressable
                  accessibilityLabel="Editar preferencias"
                  accessibilityRole="button"
                  onPress={openEditor}
                  style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
                >
                  <Ionicons color="#f6c85f" name="create-outline" size={16} />
                  <Text style={styles.editText}>Modificar preferencias</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}
      </View>

      <Modal
        animationType="slide"
        onRequestClose={saving ? undefined : closeEditor}
        statusBarTranslucent
        transparent
        visible={editing}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            accessibilityLabel="Cerrar preferencias"
            disabled={saving}
            onPress={closeEditor}
            style={styles.backdrop}
          />
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetEyebrow}>AJUSTAR RECOMENDACIONES</Text>
                <Text style={styles.sheetTitle}>Tus preferencias</Text>
              </View>
              <Pressable
                accessibilityLabel="Cerrar"
                disabled={saving}
                onPress={closeEditor}
                style={styles.closeButton}
              >
                <Ionicons color="#ddd" name="close" size={23} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
              style={styles.editorScroll}
            >
              <Text style={styles.editorLabel}>PLATAFORMAS</Text>
              <Text style={styles.editorHint}>Marcá todos los servicios que tenés disponibles.</Text>
              <ChoiceGrid
                items={platforms}
                onToggle={(id) => setSelectedPlatforms((current) => toggleSelection(current, id))}
                selected={selectedPlatforms}
              />

              <Text style={styles.editorLabel}>GÉNEROS</Text>
              <Text style={styles.editorHint}>Podés sumar o quitar gustos cuando quieras.</Text>
              <ChoiceGrid
                items={genres}
                onToggle={(id) => setSelectedGenres((current) => toggleSelection(current, id))}
                selected={selectedGenres}
              />
            </ScrollView>

            <Pressable
              disabled={saving}
              onPress={() => void handleSave()}
              style={({ pressed }) => [
                styles.saveButton,
                saving && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons color="#fff" name="checkmark" size={19} />
              )}
              <Text style={styles.saveText}>{saving ? 'Guardando...' : 'Guardar cambios'}</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#121012',
    borderColor: '#30272a',
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 18,
    marginTop: 18,
    padding: 16,
  },
  header: { alignItems: 'center', flexDirection: 'row', minHeight: 40 },
  headerPressed: { opacity: 0.72 },
  headerIcon: {
    alignItems: 'center',
    backgroundColor: '#2a1116',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerCopy: { flex: 1, marginLeft: 10 },
  eyebrow: { color: '#ff7b80', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 2 },
  editButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#282116',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 4,
    marginTop: 17,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  editText: { color: '#f6c85f', fontSize: 11, fontWeight: '900' },
  groupLabel: {
    color: '#82777a',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 7,
    marginTop: 15,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  summaryChip: { backgroundColor: '#27171a', borderRadius: 13, paddingHorizontal: 9, paddingVertical: 6 },
  summaryChipText: { color: '#e7dfe1', fontSize: 11, fontWeight: '700' },
  emptyPreference: { color: '#756c6f', fontSize: 12 },
  expandedContent: { borderTopColor: '#2b2326', borderTopWidth: 1, marginTop: 14 },
  statusRow: { alignItems: 'center', flexDirection: 'row', gap: 9, marginTop: 16 },
  statusText: { color: '#8e8487', fontSize: 12 },
  errorBox: { gap: 7, marginTop: 14 },
  errorText: { color: '#d4b6ba', fontSize: 12, lineHeight: 17 },
  retryText: { color: '#ff7b80', fontSize: 12, fontWeight: '900' },
  modalOverlay: { backgroundColor: 'rgba(0,0,0,0.55)', flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: '#100d0f',
    borderColor: '#372b2f',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    maxHeight: '92%',
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: '#54494c',
    borderRadius: 3,
    height: 5,
    marginBottom: 16,
    marginTop: 9,
    width: 44,
  },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sheetEyebrow: { color: '#ff7379', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  sheetTitle: { color: '#fff', fontSize: 25, fontWeight: '900', marginTop: 2 },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#282326',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  sheetContent: { paddingBottom: 22 },
  editorScroll: { flexShrink: 1 },
  editorLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginTop: 25,
  },
  editorHint: { color: '#857a7d', fontSize: 12, marginBottom: 12, marginTop: 4 },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  choice: {
    alignItems: 'center',
    backgroundColor: '#191619',
    borderColor: '#373034',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  choiceActive: { backgroundColor: '#97141e', borderColor: '#df3540' },
  choiceText: { color: '#aaa0a3', fontSize: 13, fontWeight: '700' },
  choiceTextActive: { color: '#fff' },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#b41622',
    borderRadius: 17,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
  },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
