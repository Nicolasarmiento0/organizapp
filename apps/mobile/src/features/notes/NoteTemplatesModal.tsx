import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowRight, Sparkles, X } from '../../components/icons';
import { radii, shadows, spacing, typography } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import { resolveNoteIcon } from './noteIcons';
import { NOTE_TEMPLATES, type NoteTemplateId } from './noteTemplates';

export interface NoteTemplatesModalProps {
  visible: boolean;
  onSelectTemplate: (templateId: NoteTemplateId) => void;
  onClose: () => void;
}

export const NoteTemplatesModal: React.FC<NoteTemplatesModalProps> = ({
  visible,
  onSelectTemplate,
  onClose,
}) => {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheetWrap} onPress={(e) => e.stopPropagation()}>
          <LiquidGlassCard variant="floating" style={[styles.card, shadows.floatingDock]}>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <View
                  style={[
                    styles.badgeIcon,
                    {
                      backgroundColor: theme.accentPrimarySoft,
                      borderColor: theme.accentPrimaryBorder,
                    },
                  ]}
                >
                  <Sparkles size={16} color={theme.accentPrimaryLink} />
                </View>
                <View>
                  <Text style={[styles.title, { color: theme.textPrimary }]}>
                    Plantillas de 1 Toque
                  </Text>
                  <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                    Crea estructuras listas sincronizadas en la nube
                  </Text>
                </View>
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <X size={18} color={theme.textSecondary} strokeWidth={2} />
              </Pressable>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.grid}>
              {NOTE_TEMPLATES.map((tpl) => {
                const IconComp = resolveNoteIcon(tpl.icon);
                return (
                  <Pressable
                    key={tpl.id}
                    onPress={() => {
                      onSelectTemplate(tpl.id);
                      onClose();
                    }}
                    style={({ pressed }) => [
                      styles.tplCard,
                      {
                        backgroundColor: theme.cardElevated,
                        borderColor: theme.glassBorder,
                        opacity: pressed ? 0.86 : 1,
                      },
                    ]}
                  >
                    <View style={styles.tplTop}>
                      <View
                        style={[
                          styles.tplIconBox,
                          {
                            backgroundColor: theme.accentPrimarySoft,
                            borderColor: theme.accentPrimaryBorder,
                          },
                        ]}
                      >
                        <IconComp size={18} color={theme.accentPrimaryLink} />
                      </View>
                      <ArrowRight size={15} color={theme.textMuted} strokeWidth={2} />
                    </View>

                    <Text style={[styles.tplTitle, { color: theme.textPrimary }]}>
                      {tpl.title}
                    </Text>
                    <Text style={[styles.tplSub, { color: theme.textSecondary }]}>
                      {tpl.subtitle}
                    </Text>

                    <View style={styles.chipsRow}>
                      {tpl.previewChips.map((chip) => (
                        <View
                          key={`${tpl.id}_${chip}`}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: theme.pillBg,
                              borderColor: theme.glassBorder,
                            },
                          ]}
                        >
                          <Text style={[styles.chipText, { color: theme.textMuted }]}>
                            {chip}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </LiquidGlassCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  sheetWrap: {
    width: '100%',
    maxWidth: 560,
  },
  card: {
    borderRadius: radii.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  badgeIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.squircle,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    ...typography.cardTitle,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  scroll: {
    maxHeight: 440,
  },
  grid: {
    gap: spacing.sm,
  },
  tplCard: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: 6,
  },
  tplTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tplIconBox: {
    width: 34,
    height: 34,
    borderRadius: radii.squircle,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tplTitle: {
    fontSize: 15,
    ...typography.heading3,
  },
  tplSub: {
    fontSize: 12,
    lineHeight: 17,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '600',
  },
});

export default NoteTemplatesModal;
