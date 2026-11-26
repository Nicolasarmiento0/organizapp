import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Bell,
  CalendarClock,
  CheckSquare,
  FileText,
  Flame,
  Sparkles,
  X,
} from '../icons';
import type { TaskPriority } from '@organiza/shared/schema';
import {
  iconMetrics,
  radii,
  shadows,
  spacing,
  typography,
  type MacModuleType,
} from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { LiquidGlassCard } from './LiquidGlassCard';
import { MacIconBadge } from './MacIconBadge';
import {
  insertHabitOfflineFirst,
  insertTaskOfflineFirst,
} from '../../features/today';
import { insertWorkBlockOfflineFirst } from '../../features/calendar';
import { insertNotePageOfflineFirst } from '../../features/notes';

export type QuickCaptureMode = 'task' | 'habit' | 'schedule' | 'note';

export interface QuickCaptureSheetProps {
  visible: boolean;
  onClose: () => void;
  userId?: string;
  initialMode?: QuickCaptureMode;
}

type ReminderPreset = 'none' | '30m' | '2h' | 'tomorrow9am';

function computeReminderTimestamp(preset: ReminderPreset): number | null {
  const now = Date.now();
  if (preset === 'none') return null;
  if (preset === '30m') return now + 30 * 60 * 1000;
  if (preset === '2h') return now + 2 * 60 * 60 * 1000;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow.getTime();
}

export const QuickCaptureSheet: React.FC<QuickCaptureSheetProps> = ({
  visible,
  onClose,
  userId = '',
  initialMode = 'task',
}) => {
  const { theme, isDark } = useTheme();
  const [mode, setMode] = useState<QuickCaptureMode>(initialMode);
  const [title, setTitle] = useState('');
  const [notesOrMarkdown, setNotesOrMarkdown] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(2);
  const [reminderPreset, setReminderPreset] = useState<ReminderPreset>('none');
  const [timeSlot, setTimeSlot] = useState<'09:00-11:00' | '14:00-16:00' | '17:00-18:30'>(
    '09:00-11:00'
  );

  useEffect(() => {
    if (visible) {
      setMode(initialMode);
    }
  }, [visible, initialMode]);

  const resetForm = () => {
    setTitle('');
    setNotesOrMarkdown('');
    setPriority(2);
    setReminderPreset('none');
  };

  const handleSaveOfflineFirst = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      return;
    }

    if (mode === 'task') {
      const reminderAt = computeReminderTimestamp(reminderPreset);
      insertTaskOfflineFirst({
        title: cleanTitle,
        notes: notesOrMarkdown,
        category: reminderAt ? 'reminder' : 'today',
        priority,
        reminderAt,
        userId,
      });
    } else if (mode === 'habit') {
      insertHabitOfflineFirst({
        title: cleanTitle,
        icon: 'Sparkles',
        frequency: 'daily',
        reminderTime: '08:30',
        userId,
      });
    } else if (mode === 'schedule') {
      const [startTime = '09:00', endTime = '11:00'] = timeSlot.split('-');
      insertWorkBlockOfflineFirst({
        title: cleanTitle,
        blockType: 'deep_work',
        startTime,
        endTime,
        locationOrLink: notesOrMarkdown || 'Bloque de Enfoque',
        isRecurring: false,
        userId,
      });
    } else if (mode === 'note') {
      insertNotePageOfflineFirst({
        title: cleanTitle,
        contentMarkdown: notesOrMarkdown || `# ${cleanTitle}\n\n`,
        isPinned: false,
        userId,
      });
    }

    resetForm();
    onClose();
  };

  const modeTabs: Array<{
    key: QuickCaptureMode;
    label: string;
    module: MacModuleType;
    icon: typeof CheckSquare;
  }> = [
    { key: 'task', label: 'Recordatorio', module: 'reminders', icon: CheckSquare },
    { key: 'habit', label: 'Hábito', module: 'habits', icon: Flame },
    { key: 'schedule', label: 'Calendario', module: 'calendar', icon: CalendarClock },
    { key: 'note', label: 'Nota', module: 'notes', icon: FileText },
  ];

  const activeTabMeta = modeTabs.find((t) => t.key === mode) ?? modeTabs[0]!;
  const remindersPalette = theme.modules.reminders;

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
              ? 'rgba(5, 7, 10, 0.72)'
              : 'rgba(15, 17, 21, 0.28)',
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
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <MacIconBadge
                icon={activeTabMeta.icon}
                module={activeTabMeta.module}
                containerSize={36}
                size={18}
              />
              <View>
                <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>
                  Captura Instantánea
                </Text>
                <Text style={[styles.sheetSubtitle, { color: theme.textSecondary }]}>
                  Sincronizado automáticamente en la nube
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

          {/* Selector de Módulo */}
          <View style={styles.modeSelectorRow}>
            {modeTabs.map((item) => {
              const isSelected = item.key === mode;
              const palette = theme.modules[item.module];
              const IconComp = item.icon;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setMode(item.key)}
                  style={[
                    styles.modePill,
                    {
                      borderColor: isSelected ? palette.border : theme.glassBorder,
                      backgroundColor: isSelected ? palette.background : theme.pillBg,
                    },
                  ]}
                >
                  <IconComp
                    size={15}
                    color={isSelected ? palette.icon : theme.textSecondary}
                    strokeWidth={iconMetrics.strokeWidth}
                  />
                  <Text
                    style={[
                      styles.modePillText,
                      { color: theme.textSecondary },
                      isSelected && { color: palette.icon, fontWeight: '600' },
                    ]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Inputs Principales */}
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={
              mode === 'task'
                ? '¿Qué necesitas completar o recordar hoy?'
                : mode === 'habit'
                  ? 'Ej. Meditación 15 min o Lectura técnica...'
                  : mode === 'schedule'
                    ? 'Ej. Bloque Deep Work: Arquitectura...'
                    : 'Título de la página o nota rápida...'
            }
            placeholderTextColor={theme.textMuted}
            style={[
              styles.titleInput,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.glassBorder,
                color: theme.textPrimary,
              },
            ]}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSaveOfflineFirst}
          />

          {mode !== 'habit' && (
            <TextInput
              value={notesOrMarkdown}
              onChangeText={setNotesOrMarkdown}
              placeholder={
                mode === 'note'
                  ? 'Escribe en Markdown (# encabezados, - listas)...'
                  : 'Notas adicionales o contexto opcional...'
              }
              placeholderTextColor={theme.textMuted}
              style={[
                styles.notesInput,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.glassBorder,
                  color: theme.textPrimary,
                },
                mode === 'note' && styles.markdownInputHeight,
              ]}
              multiline
            />
          )}

          {/* Opciones específicas de Tarea / Recordatorio */}
          {mode === 'task' && (
            <View style={styles.optionsBlock}>
              <Text style={[styles.optionLabel, { color: theme.textSecondary }]}>
                Prioridad & Alerta Local ($0)
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
                          borderColor: active ? theme.accentCobaltBorder : theme.glassBorder,
                          backgroundColor: active ? theme.accentCobaltSoft : theme.inputBg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: active ? theme.accentCobaltBright : theme.textSecondary },
                          active && { fontWeight: '600' },
                        ]}
                      >
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.chipsRow}>
                {(
                  [
                    { key: 'none' as const, label: 'Sin alerta' },
                    { key: '30m' as const, label: '+30 min' },
                    { key: '2h' as const, label: '+2 horas' },
                    { key: 'tomorrow9am' as const, label: 'Mañana 09:00' },
                  ]
                ).map((rem) => {
                  const active = reminderPreset === rem.key;
                  return (
                    <Pressable
                      key={rem.key}
                      onPress={() => setReminderPreset(rem.key)}
                      style={[
                        styles.chip,
                        {
                          borderColor: active ? remindersPalette.border : theme.glassBorder,
                          backgroundColor: active ? remindersPalette.background : theme.inputBg,
                        },
                      ]}
                    >
                      <Bell
                        size={12}
                        color={active ? remindersPalette.icon : theme.textSecondary}
                        strokeWidth={iconMetrics.strokeWidth}
                      />
                      <Text
                        style={[
                          styles.chipText,
                          { color: active ? remindersPalette.icon : theme.textSecondary },
                          active && { fontWeight: '600' },
                        ]}
                      >
                        {rem.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Opciones específicas de Horario */}
          {mode === 'schedule' && (
            <View style={styles.optionsBlock}>
              <Text style={[styles.optionLabel, { color: theme.textSecondary }]}>
                Franja de Time-Blocking
              </Text>
              <View style={styles.chipsRow}>
                {(
                  ['09:00-11:00', '14:00-16:00', '17:00-18:30'] as const
                ).map((slot) => {
                  const active = timeSlot === slot;
                  return (
                    <Pressable
                      key={slot}
                      onPress={() => setTimeSlot(slot)}
                      style={[
                        styles.chip,
                        {
                          borderColor: active ? theme.accentCobaltBorder : theme.glassBorder,
                          backgroundColor: active ? theme.accentCobaltSoft : theme.inputBg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: active ? theme.accentCobaltBright : theme.textSecondary },
                          active && { fontWeight: '600' },
                        ]}
                      >
                        {slot}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Botón Primario Azul Eléctrico Cobalt */}
          <Pressable
            onPress={handleSaveOfflineFirst}
            style={({ pressed }) => [
              styles.submitButton,
              { backgroundColor: theme.accentCobalt },
              !title.trim() && styles.submitButtonDisabled,
              pressed && styles.submitButtonPressed,
            ]}
          >
            <Sparkles size={16} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.submitButtonText}>
              Guardar en la nube
            </Text>
          </Pressable>
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
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSelectorRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: radii.squircle,
    borderWidth: 1,
  },
  modePillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  titleInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: '500',
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  markdownInputHeight: {
    minHeight: 96,
  },
  optionsBlock: {
    gap: spacing.sm,
  },
  optionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
    fontWeight: '500',
  },
  submitButton: {
    marginTop: spacing.xs,
    borderRadius: radii.md,
    paddingVertical: 14,
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
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});

export default QuickCaptureSheet;
