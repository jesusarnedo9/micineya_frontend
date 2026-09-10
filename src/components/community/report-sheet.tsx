import { Modal, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReportReason } from '../../api/community';
import { CommunityButton, s } from './community-ui';

const reasons: [ReportReason, string][] = [
  ['ACOSO', 'Acoso, odio o amenazas'], ['CONTENIDO_INAPROPIADO', 'Contenido inapropiado'],
  ['DATOS_PERSONALES', 'Expone datos personales'], ['SPAM', 'Spam'], ['SPOILER', 'Spoiler sin marcar'], ['OTRO', 'Otro incumplimiento'],
];

export function ReportSheet({ visible, busy, error, onClose, onReason }: { visible: boolean; busy: boolean; error: string | null; onClose: () => void; onReason: (reason: ReportReason) => void }) {
  const insets = useSafeAreaInsets();
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={busy ? undefined : onClose}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0009' }}>
      <ScrollView style={{ maxHeight: '85%', backgroundColor: '#171214', borderTopLeftRadius: 24, borderTopRightRadius: 24 }} contentContainerStyle={[s.content, { paddingBottom: Math.max(insets.bottom, 30) }]}>
        <Text style={s.heading}>Reportar contenido</Text>
        <Text style={s.muted}>Elegí el motivo. Tu identidad no se muestra a la persona reportada. El reporte será revisado; no oculta el contenido automáticamente.</Text>
        {reasons.map(([reason, label]) => <CommunityButton key={reason} title={label} secondary disabled={busy} onPress={() => onReason(reason)} />)}
        {error && <Text style={s.error}>{error}</Text>}
        <CommunityButton title={busy ? 'Enviando…' : 'Cancelar'} disabled={busy} onPress={onClose} />
      </ScrollView>
    </View>
  </Modal>;
}
