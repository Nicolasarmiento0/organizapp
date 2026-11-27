import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { TaskPriority, TaskRecord } from '@organiza/shared/schema';
import {
  Bell,
  CalendarClock,
  Flag,
  Sparkles,
  Trash2,
  X,
} from '../../components/icons';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import { MacIconBadge } from '../../components/glass/MacIconBadge';
import { iconMetrics, radii, shadows, spacing, typography } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import {
  computeQuickPreset,
  extractDateAndTimeInputs,
  parseCustomDateTime,
  type QuickDatePreset,
} from './reminderUtils';

export interface ReminderEditorSavePayload {
  title: string;
  notes: string;
  priority: TaskPriority;
  isFlagged: boolean;
  dueDate: string | null;
  reminderAt: number | null;
}

export interface ReminderEditorModalProps {
  visible: boolean;
  task?: TaskRecord | null;
  defaultFlagged?: boolean;
  defaultDueDate?: string | null;
  onClose: () => void;
  onSave: (payload: ReminderEditorSavePayload) => void;
  onDelete?: (taskId: string) => void;
}

const PRESET_OPTIONS: Array<{ key: QuickDatePreset; label: string }> = [
  { key: 'none', label: 'Sin fecha' },
  { key: '30m', label: '+30 min' },
  { key: '1h', label: '+1 hora' },
  { key: 'today18', label: 'Hoy 18:00' },
  { key: 'tomorrow9', label: 'Mañana 09:00' },
  { key: 'custom', label: 'Fecha y hora' },
];

export const ReminderEditorModal: React.FC<ReminderEditorModalProps> = ({
  visible,
  task,
  defaultFlagged = false,
  defaultDueDate = null,
  onClose,
  onSave,
  onDelete,
}) => {
  const { theme, isDark } = useTheme();
  const isEditing = Boolean(task);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(2);
  const [isFlagged, setIsFlagged] = useState(false);
  const [preset, setPreset] = useState<QuickDatePreset>('none');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setErrorMsg(null);
    if (task) {
      setTitle(task.title);
      setNotes(task.notes ?? '');
      setPriority(task.priority);
      setIsFlagged(Boolean(task.isFlagged));
      const extracted = extractDateAndTimeInputs(task);
      setDateStr(extracted.dateStr);
      setTimeStr(extracted.timeStr);
      setPreset(task.reminderAt || task.dueDate ? 'custom' : 'none');
    } else {
      setTitle('');
      setNotes('');
      setPriority(defaultFlagged ? 3 : 2);
      setIsFlagged(defaultFlagged);
      if (defaultDueDate) {
        setPreset('custom');
        setDateStr(defaultDueDate);
        setTimeStr('');
      } else {
        setPreset('none');
        setDateStr('');
        setTimeStr('');
      }
    }
  }, [visible, task, defaultFlagged, defaultDueDate]);

  const handleSelectPreset = (nextPreset: QuickDatePreset) => {
    setErrorMsg(null);
    setPreset(nextPreset);
    if (nextPreset === 'none') {
      setDateStr('');
      setTimeStr('');
      return;
    }
    if (nextPreset === 'custom') {
      if (!dateStr) {
        const extracted = extractDateAndTimeInputs(task);
        setDateStr(extracted.dateStr);
      }
      return;
    }
    const computed = computeQuickPreset(nextPreset);
    setDateStr(computed.dueDate ?? '');
    if (computed.reminderAt) {
      const d = new Date(computed.reminderAt);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      setTimeStr(`${hh}:${mm}`);
    } else {
      setTimeStr('');
    }
  };

  const handleSubmit = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMsg('Escribe un título para el recordatorio.');
      return;
    }

    let dueDate: string | null = null;
    let reminderAt: number | null = null;

    if (preset === 'none') {
      dueDate = null;
      reminderAt = null;
    } else if (preset === 'custom') {
      const parsed = parseCustomDateTime(dateStr, timeStr);
      if (parsed.error) {
        setErrorMsg(parsed.error);
        return;
      }
      dueDate = parsed.dueDate;
      reminderAt = parsed.reminderAt;
    } else {
      const computed = computeQuickPreset(preset);
      dueDate = computed.dueDate;
      reminderAt = computed.reminderAt;
    }

    onSave({
      title: cleanTitle,
      notes: notes.trim(),
      priority,
      isFlagged,
      dueDate,
      reminderAt,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[
          styles.backdrop,
          {
            backgroundColor: isDark
              ? 'rgba(5, 7, 10, 0.74)'
              : 'rgba(15, 17, 21, 0.30)',
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <LiquidGlassCard
          variant="floating"
          intensity={85}
          style={styles.sheetContainer}
          contentStyle={styles.sheetContent}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <MacIconBadge
                icon={Bell}
                module="reminders"
                containerSize={36}
                size={18}
              />
              <View>
                <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>
                  {isEditing ? 'Editar Recordatorio' : 'Nuevo Recordatorio'}
                </Text>
                <Text style={[styles.sheetSubtitle, { color: theme.textSecondary }]}>
                  Fecha, hora exacta y prioridad sincronizadas
                </Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: theme.pillBg }]}
              hitSlop={10}
            >
              <X
                size={18}
                color={theme.textSecondary}
                strokeWidth={iconMetrics.strokeWidth}
              />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.formBody}
          >
            <TextInput
              value={title}
              onChangeText={(v) => {
                setTitle(v);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="Ej. Enviar propuesta o llamar al banco..."
              placeholderTextColor={theme.textMuted}
              style={[
                styles.titleInput,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.glassBorder,
                  color: theme.textPrimary,
                },
              ]}
              autoFocus={!isEditing}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Notas o contexto adicional (opcional)..."
              placeholderTextColor={theme.textMuted}
              style={[
                styles.notesInput,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.glassBorder,
                  color: theme.textPrimary,
                },
              ]}
              multiline
            />

            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                Prioridad & Bandera
              </Text>
              <View style={styles.chipsRow}>
                {(
                  [
                    { value: 3 as TaskPriority, label: 'Alta' },
                    { value: 2 as TaskPriority, label: 'Media' },
                    { value: 1 as TaskPriority, label: 'Baja' },
                  ] as const
                ).map((p) => {
                  const active = priority === p.value;
                  return (
                    <Pressable
                      key={p.value}
                      onPress={() => setPriority(p.value)}
                      style={[
                        styles.chip,
                        {
                          borderColor: active
                            ? theme.accentPrimaryBorder
                            : theme.glassBorder,
                          backgroundColor: active
                            ? theme.accentPrimarySoft
                            : theme.inputBg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: active
                              ? theme.accentPrimaryLink
                              : theme.textSecondary,
                          },
                          active && styles.chipTextActive,
                        ]}
                      >
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}

                <Pressable
                  onPress={() => setIsFlagged((prev) => !prev)}
                  style={[
                    styles.chip,
                    {
                      borderColor: isFlagged
                        ? theme.accentPrimaryBorder
                        : theme.glassBorder,
                      backgroundColor: isFlagged
                        ? theme.accentPrimarySoft
                        : theme.inputBg,
                    },
                  ]}
                >
                  <Flag
                    size={13}
                    color={
                      isFlagged ? theme.accentPrimaryLink : theme.textSecondary
                    }
                    strokeWidth={iconMetrics.strokeWidth}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: isFlagged
                          ? theme.accentPrimaryLink
                          : theme.textSecondary,
                      },
                      isFlagged && styles.chipTextActive,
                    ]}
                  >
                    Con bandera
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                Programar aviso
              </Text>
              <View style={styles.chipsRow}>
                {PRESET_OPTIONS.map((item) => {
                  const active = preset === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => handleSelectPreset(item.key)}
                      style={[
                        styles.chip,
                        {
                          borderColor: active
                            ? theme.accentPrimaryBorder
                            : theme.glassBorder,
                          backgroundColor: active
                            ? theme.accentPrimarySoft
                            : theme.inputBg,
                        },
                      ]}
                    >
                      {item.key === 'custom' ? (
                        <CalendarClock
                          size={12}
                          color={
                            active
                              ? theme.accentPrimaryLink
                              : theme.textSecondary
                          }
                          strokeWidth={iconMetrics.strokeWidth}
                        />
                      ) : null}
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: active
                              ? theme.accentPrimaryLink
                              : theme.textSecondary,
                          },
                          active && styles.chipTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {preset === 'custom' ? (
                <View style={styles.customDateRow}>
                  <View style={styles.customField}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                      Fecha (AAAA-MM-DD)
                    </Text>
                    <TextInput
                      value={dateStr}
                      onChangeText={(v) => {
                        setDateStr(v);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      placeholder="2026-11-27"
                      placeholderTextColor={theme.textMuted}
                      style={[
                        styles.customInput,
                        {
                          backgroundColor: theme.inputBg,
                          borderColor: theme.glassBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.customField}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                      Hora (HH:mm, opcional)
                    </Text>
                    <TextInput
                      value={timeStr}
                      onChangeText={(v) => {
                        setTimeStr(v);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      placeholder="09:30"
                      placeholderTextColor={theme.textMuted}
                      style={[
                        styles.customInput,
                        {
                          backgroundColor: theme.inputBg,
                          borderColor: theme.glassBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                    />
                  </View>
                </View>
              ) : null}
            </View>

            {errorMsg ? (
              <View
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor: theme.dangerSoft,
                    borderColor: theme.accentPrimaryBorder,
                  },
                ]}
              >
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {errorMsg}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footerRow}>
            {isEditing && task && onDelete ? (
              <Pressable
                onPress={() => {
                  onDelete(task.id);
                  onClose();
                }}
                style={[
                  styles.deleteButton,
                  {
                    backgroundColor: theme.dangerSoft,
                    borderColor: theme.accentPrimaryBorder,
                  },
                ]}
              >
                <Trash2 size={16} color={theme.danger} strokeWidth={2} />
                <Text style={[styles.deleteButtonText, { color: theme.danger }]}>
                  Eliminar
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.submitButton,
                { backgroundColor: theme.accentPrimary },
                !title.trim() && styles.submitButtonDisabled,
                pressed && styles.submitButtonPressed,
              ]}
            >
              <Sparkles
                size={16}
                color={theme.accentPrimaryText}
                strokeWidth={2}
              />
              <Text
                style={[
                  styles.submitButtonText,
                  { color: theme.accentPrimaryText },
                ]}
              >
                {isEditing ? 'Guardar cambios' : 'Crear recordatorio'}
              </Text>
            </Pressable>
          </View>
        </LiquidGlassCard>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    paddingHorizontal: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl : spacing.lg,
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
    alignSelf: 'center',
    borderRadius: radii.xl,
    ...shadows.modal,
  },
  sheetContent: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sheetTitle: {
    fontSize: 17,
    ...typography.cardTitle,
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
    ...typography.caption,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formBody: {
    gap: spacing.md,
  },
  titleInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    ...typography.bodyMedium,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
    ...typography.body,
  },
  sectionBlock: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    ...typography.eyebrow,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    ...typography.label,
  },
  chipTextActive: {
    ...typography.bodySemiBold,
  },
  customDateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 2,
  },
  customField: {
    flex: 1,
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11,
    ...typography.label,
  },
  customInput: {
    borderWidth: 1,
    borderRadius: radii.squircle,
    paddingHorizontal: spacing.md,
    height: 38,
    fontSize: 13,
    ...typography.bodyMedium,
  },
  errorBanner: {
    borderWidth: 1,
    borderRadius: radii.squircle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    fontSize: 12,
    ...typography.bodyMedium,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  deleteButtonText: {
    fontSize: 14,
    ...typography.bodySemiBold,
  },
  submitButton: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  submitButtonText: {
    fontSize: 15,
    ...typography.bodySemiBold,
  },
});

export default ReminderEditorModal;
