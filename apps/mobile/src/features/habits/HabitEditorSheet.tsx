import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Minus, PauseCircle, Plus, Target, Trash2, X } from '../../components/icons';
import type {
  HabitRecord,
  HabitTimeOfDay,
  HabitType,
} from '@organiza/shared/schema';
import { iconMetrics, radii, shadows, spacing, typography } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import { HABIT_ICON_OPTIONS } from './habitIcons';
import {
  computeWeeklyGoalPoints,
  parseScheduledDays,
  shiftDateKey,
} from './streakEngine';
import type { UpsertHabitInput } from './useHabitsManager';
import { getTodayDateKey } from '../../db/client';

const WEEK_DAYS_ORDER = [
  { day: 1, label: 'L' },
  { day: 2, label: 'M' },
  { day: 3, label: 'X' },
  { day: 4, label: 'J' },
  { day: 5, label: 'V' },
  { day: 6, label: 'S' },
  { day: 0, label: 'D' },
] as const;

const UNIT_PRESETS = ['vasos', 'págs', 'min', 'km', 'veces'] as const;

const TIME_OF_DAY_OPTIONS: Array<{ key: HabitTimeOfDay; label: string }> = [
  { key: 'any', label: 'Cualquiera' },
  { key: 'morning', label: 'Mañana' },
  { key: 'afternoon', label: 'Tarde' },
  { key: 'evening', label: 'Noche' },
];

export interface HabitEditorSheetProps {
  visible: boolean;
  habitToEdit?: HabitRecord | null;
  onClose: () => void;
  onSave: (input: UpsertHabitInput, existingHabitId?: string) => void;
  onDelete?: (habitId: string) => void;
}

export const HabitEditorSheet: React.FC<HabitEditorSheetProps> = ({
  visible,
  habitToEdit,
  onClose,
  onSave,
  onDelete,
}) => {
  const { theme, isDark } = useTheme();
  const todayKey = getTodayDateKey();

  const [title, setTitle] = useState('');
  const [habitType, setHabitType] = useState<HabitType>('binary');
  const [targetPerDay, setTargetPerDay] = useState(8);
  const [unit, setUnit] = useState('vasos');
  const [scheduledDays, setScheduledDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [timeOfDay, setTimeOfDay] = useState<HabitTimeOfDay>('any');
  const [iconName, setIconName] = useState('Sparkles');
  const [reminderTime, setReminderTime] = useState('');
  const [hasWeeklyGoal, setHasWeeklyGoal] = useState(false);
  const [weeklyGoal, setWeeklyGoal] = useState(3);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseDuration, setPauseDuration] = useState<'indefinite' | '3d' | '7d' | '14d'>(
    'indefinite'
  );

  useEffect(() => {
    if (!visible) return;
    if (habitToEdit) {
      setTitle(habitToEdit.title);
      setHabitType(habitToEdit.habitType ?? 'binary');
      setTargetPerDay(Math.max(1, habitToEdit.targetPerDay ?? 1));
      setUnit(habitToEdit.unit || 'vasos');
      setScheduledDays(parseScheduledDays(habitToEdit.scheduledDays));
      setTimeOfDay(habitToEdit.timeOfDay ?? 'any');
      setIconName(habitToEdit.icon || 'Sparkles');
      setReminderTime(habitToEdit.reminderTime || '');
      const existingGoal = habitToEdit.weeklyGoal ?? null;
      setHasWeeklyGoal(Boolean(existingGoal && existingGoal > 0));
      setWeeklyGoal(existingGoal && existingGoal > 0 ? existingGoal : 3);
      setIsPaused(Boolean(habitToEdit.isPaused));
      setPauseDuration(habitToEdit.pausedUntil ? '7d' : 'indefinite');
    } else {
      setTitle('');
      setHabitType('binary');
      setTargetPerDay(8);
      setUnit('vasos');
      setScheduledDays([0, 1, 2, 3, 4, 5, 6]);
      setTimeOfDay('any');
      setIconName('Sparkles');
      setReminderTime('');
      setHasWeeklyGoal(false);
      setWeeklyGoal(3);
      setIsPaused(false);
      setPauseDuration('indefinite');
    }
  }, [visible, habitToEdit]);

  const toggleDay = (day: number) => {
    setScheduledDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev; // Al menos 1 día activo
        return prev.filter((d) => d !== day);
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  };

  const applyPreset = (preset: 'daily' | 'weekdays' | 'weekends') => {
    if (preset === 'daily') setScheduledDays([0, 1, 2, 3, 4, 5, 6]);
    else if (preset === 'weekdays') setScheduledDays([1, 2, 3, 4, 5]);
    else setScheduledDays([0, 6]);
  };

  const isPresetDaily = scheduledDays.length === 7;
  const isPresetWeekdays =
    scheduledDays.length === 5 &&
    [1, 2, 3, 4, 5].every((d) => scheduledDays.includes(d));
  const isPresetWeekends =
    scheduledDays.length === 2 &&
    scheduledDays.includes(0) &&
    scheduledDays.includes(6);

  const handleSubmit = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    let pausedUntil: string | null = null;
    if (isPaused) {
      if (pauseDuration === '3d') pausedUntil = shiftDateKey(todayKey, 3);
      else if (pauseDuration === '7d') pausedUntil = shiftDateKey(todayKey, 7);
      else if (pauseDuration === '14d') pausedUntil = shiftDateKey(todayKey, 14);
      else pausedUntil = null;
    }

    onSave(
      {
        title: cleanTitle,
        icon: iconName,
        habitType,
        unit: habitType === 'quantitative' ? unit.trim() || 'veces' : null,
        targetPerDay: habitType === 'quantitative' ? Math.max(1, targetPerDay) : 1,
        frequency: isPresetDaily
          ? 'daily'
          : isPresetWeekdays
            ? 'weekdays'
            : isPresetWeekends
              ? 'weekends'
              : 'custom',
        scheduledDays,
        timeOfDay,
        reminderTime: reminderTime.trim() || null,
        weeklyGoal: hasWeeklyGoal ? weeklyGoal : null,
        isPaused,
        pausedUntil,
      },
      habitToEdit?.id
    );
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
              ? 'rgba(5, 7, 10, 0.76)'
              : 'rgba(15, 17, 21, 0.30)',
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <LiquidGlassCard
          variant="floating"
          intensity={85}
          noPadding
          style={styles.sheetContainer}
        >
          <ScrollView
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.headerRow}>
              <View>
                <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>
                  {habitToEdit ? 'Configurar Hábito' : 'Nuevo Hábito Inteligente'}
                </Text>
                <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>
                  Rachas adaptativas · Turnos · Contadores Tesla
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={[styles.closeBtn, { backgroundColor: theme.pillBg }]}
                hitSlop={10}
              >
                <X size={18} color={theme.textSecondary} strokeWidth={iconMetrics.strokeWidth} />
              </Pressable>
            </View>

            {/* Nombre */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                Nombre del hábito
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Ej. Tomar creatina, Beber 8 vasos de agua..."
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.glassBorder,
                    color: theme.textPrimary,
                  },
                ]}
                autoFocus={!habitToEdit}
              />
            </View>

            {/* Tipo: Binario vs Cuantitativo */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                Tipo de seguimiento
              </Text>
              <View style={[styles.segmentBox, { backgroundColor: theme.pillBg }]}>
                {(
                  [
                    { key: 'binary' as const, label: 'Binario (Sí / No)' },
                    { key: 'quantitative' as const, label: 'Cuantitativo (+1)' },
                  ]
                ).map((opt) => {
                  const active = habitType === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => setHabitType(opt.key)}
                      style={[
                        styles.segmentBtn,
                        active && { backgroundColor: theme.accentPrimary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          {
                            color: active
                              ? theme.accentPrimaryText
                              : theme.textSecondary,
                          },
                          active && { fontWeight: '700' },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Meta cuantitativa */}
            {habitType === 'quantitative' ? (
              <View
                style={[
                  styles.quantBox,
                  {
                    backgroundColor: theme.cardElevated,
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                <View style={styles.quantRow}>
                  <View>
                    <Text style={[styles.quantTitle, { color: theme.textPrimary }]}>
                      Meta diaria
                    </Text>
                    <Text style={[styles.quantSub, { color: theme.textSecondary }]}>
                      Cada toque suma +1
                    </Text>
                  </View>

                  <View style={styles.stepperRow}>
                    <Pressable
                      onPress={() => setTargetPerDay((n) => Math.max(1, n - 1))}
                      style={[
                        styles.stepperBtn,
                        {
                          backgroundColor: theme.pillBg,
                          borderColor: theme.glassBorder,
                        },
                      ]}
                    >
                      <Minus size={15} color={theme.textPrimary} strokeWidth={2.2} />
                    </Pressable>
                    <Text style={[styles.stepperValue, { color: theme.textPrimary }]}>
                      {targetPerDay}
                    </Text>
                    <Pressable
                      onPress={() => setTargetPerDay((n) => Math.min(200, n + 1))}
                      style={[
                        styles.stepperBtn,
                        {
                          backgroundColor: theme.accentPrimarySoft,
                          borderColor: theme.accentPrimaryBorder,
                        },
                      ]}
                    >
                      <Plus size={15} color={theme.accentPrimaryLink} strokeWidth={2.2} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.chipsWrap}>
                  {UNIT_PRESETS.map((preset) => {
                    const active = unit.trim().toLowerCase() === preset;
                    return (
                      <Pressable
                        key={preset}
                        onPress={() => setUnit(preset)}
                        style={[
                          styles.unitChip,
                          {
                            backgroundColor: active
                              ? theme.accentPrimarySoft
                              : theme.inputBg,
                            borderColor: active
                              ? theme.accentPrimaryBorder
                              : theme.glassBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.unitChipText,
                            {
                              color: active
                                ? theme.accentPrimaryLink
                                : theme.textSecondary,
                            },
                          ]}
                        >
                          {preset}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <TextInput
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="unidad..."
                    placeholderTextColor={theme.textMuted}
                    style={[
                      styles.unitInput,
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

            {/* Días Programados (Turnos / Descansos) */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                Días programados (los días libres no rompen la racha)
              </Text>
              <View style={styles.chipsWrap}>
                {(
                  [
                    { key: 'daily' as const, label: 'Todos', active: isPresetDaily },
                    { key: 'weekdays' as const, label: 'Lun–Vie', active: isPresetWeekdays },
                    { key: 'weekends' as const, label: 'Fin de sem.', active: isPresetWeekends },
                  ]
                ).map((preset) => (
                  <Pressable
                    key={preset.key}
                    onPress={() => applyPreset(preset.key)}
                    style={[
                      styles.unitChip,
                      {
                        backgroundColor: preset.active
                          ? theme.accentPrimarySoft
                          : theme.inputBg,
                        borderColor: preset.active
                          ? theme.accentPrimaryBorder
                          : theme.glassBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.unitChipText,
                        {
                          color: preset.active
                            ? theme.accentPrimaryLink
                            : theme.textSecondary,
                        },
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.weekDaysRow}>
                {WEEK_DAYS_ORDER.map((item) => {
                  const selected = scheduledDays.includes(item.day);
                  return (
                    <Pressable
                      key={item.day}
                      onPress={() => toggleDay(item.day)}
                      style={[
                        styles.dayCircle,
                        {
                          backgroundColor: selected
                            ? theme.accentPrimary
                            : theme.inputBg,
                          borderColor: selected
                            ? theme.accentPrimary
                            : theme.glassBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayCircleText,
                          {
                            color: selected
                              ? theme.accentPrimaryText
                              : theme.textSecondary,
                          },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Momento del día & Horario */}
            <View style={styles.rowTwoCols}>
              <View style={[styles.sectionBlock, { flex: 1.5 }]}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  Momento
                </Text>
                <View style={styles.chipsWrap}>
                  {TIME_OF_DAY_OPTIONS.map((t) => {
                    const active = timeOfDay === t.key;
                    return (
                      <Pressable
                        key={t.key}
                        onPress={() => setTimeOfDay(t.key)}
                        style={[
                          styles.unitChip,
                          {
                            backgroundColor: active
                              ? theme.accentPrimarySoft
                              : theme.inputBg,
                            borderColor: active
                              ? theme.accentPrimaryBorder
                              : theme.glassBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.unitChipText,
                            {
                              color: active
                                ? theme.accentPrimaryLink
                                : theme.textSecondary,
                            },
                          ]}
                        >
                          {t.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={[styles.sectionBlock, { flex: 0.7 }]}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  Aviso (HH:mm)
                </Text>
                <TextInput
                  value={reminderTime}
                  onChangeText={setReminderTime}
                  placeholder="08:30"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.glassBorder,
                      color: theme.textPrimary,
                      textAlign: 'center',
                    },
                  ]}
                />
              </View>
            </View>

            {/* Icono Vectorial */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                Icono
              </Text>
              <View style={styles.iconsGrid}>
                {HABIT_ICON_OPTIONS.map((opt) => {
                  const IconComp = opt.icon;
                  const active = iconName === opt.name;
                  return (
                    <Pressable
                      key={opt.name}
                      onPress={() => setIconName(opt.name)}
                      accessibilityLabel={opt.label}
                      style={[
                        styles.iconTile,
                        {
                          backgroundColor: active
                            ? theme.accentPrimarySoft
                            : theme.inputBg,
                          borderColor: active
                            ? theme.accentPrimaryBorder
                            : theme.glassBorder,
                        },
                      ]}
                    >
                      <IconComp
                        size={17}
                        color={active ? theme.accentPrimaryLink : theme.textSecondary}
                        strokeWidth={iconMetrics.strokeWidth}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Objetivo Semanal Opcional (Puntaje para Insignias) */}
            <View
              style={[
                styles.pauseCard,
                {
                  backgroundColor: theme.cardElevated,
                  borderColor: hasWeeklyGoal
                    ? theme.accentPrimaryBorder
                    : theme.glassBorder,
                },
              ]}
            >
              <View style={styles.pauseHeader}>
                <View style={styles.pauseTitleGroup}>
                  <Target
                    size={18}
                    color={hasWeeklyGoal ? theme.accentPrimaryLink : theme.textSecondary}
                    strokeWidth={1.9}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.quantTitle, { color: theme.textPrimary }]}>
                      Objetivo semanal (opcional)
                    </Text>
                    <Text style={[styles.quantSub, { color: theme.textSecondary }]}>
                      Da más puntos para insignias al cumplir tu meta
                    </Text>
                  </View>
                </View>
                <Switch
                  value={hasWeeklyGoal}
                  onValueChange={setHasWeeklyGoal}
                  trackColor={{
                    false: theme.pillBg,
                    true: theme.accentPrimary,
                  }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {hasWeeklyGoal ? (
                <View style={{ gap: spacing.sm }}>
                  <View style={styles.quantRow}>
                    <View style={styles.chipsWrap}>
                      {([2, 3, 4, 5, 7] as const).map((preset) => {
                        const active = weeklyGoal === preset;
                        return (
                          <Pressable
                            key={preset}
                            onPress={() => setWeeklyGoal(preset)}
                            style={[
                              styles.unitChip,
                              {
                                backgroundColor: active
                                  ? theme.accentPrimarySoft
                                  : theme.inputBg,
                                borderColor: active
                                  ? theme.accentPrimaryBorder
                                  : theme.glassBorder,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.unitChipText,
                                {
                                  color: active
                                    ? theme.accentPrimaryLink
                                    : theme.textSecondary,
                                },
                              ]}
                            >
                              {preset}x
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <View style={styles.stepperRow}>
                      <Pressable
                        onPress={() => setWeeklyGoal((n) => Math.max(1, n - 1))}
                        style={[
                          styles.stepperBtn,
                          {
                            backgroundColor: theme.pillBg,
                            borderColor: theme.glassBorder,
                          },
                        ]}
                      >
                        <Minus size={14} color={theme.textPrimary} strokeWidth={2.2} />
                      </Pressable>
                      <Text style={[styles.stepperValue, { color: theme.textPrimary }]}>
                        {weeklyGoal}x
                      </Text>
                      <Pressable
                        onPress={() => setWeeklyGoal((n) => Math.min(7, n + 1))}
                        style={[
                          styles.stepperBtn,
                          {
                            backgroundColor: theme.accentPrimarySoft,
                            borderColor: theme.accentPrimaryBorder,
                          },
                        ]}
                      >
                        <Plus size={14} color={theme.accentPrimaryLink} strokeWidth={2.2} />
                      </Pressable>
                    </View>
                  </View>

                  <Text style={[styles.quantSub, { color: theme.textSecondary }]}>
                    Puntaje semanal:{' '}
                    {Array.from({ length: weeklyGoal + 1 }, (_, i) => {
                      const cnt = weeklyGoal - i;
                      return `${cnt}/${weeklyGoal}: ${computeWeeklyGoalPoints(cnt, weeklyGoal)} pts`;
                    }).join(' · ')}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Modo Pausa */}
            <View
              style={[
                styles.pauseCard,
                {
                  backgroundColor: theme.cardElevated,
                  borderColor: isPaused
                    ? theme.accentPrimaryBorder
                    : theme.glassBorder,
                },
              ]}
            >
              <View style={styles.pauseHeader}>
                <View style={styles.pauseTitleGroup}>
                  <PauseCircle
                    size={18}
                    color={isPaused ? theme.accentPrimaryLink : theme.textSecondary}
                    strokeWidth={1.9}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.quantTitle, { color: theme.textPrimary }]}>
                      Modo Pausa (congela tu racha)
                    </Text>
                    <Text style={[styles.quantSub, { color: theme.textSecondary }]}>
                      Ideal por descanso, viaje o enfermedad
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isPaused}
                  onValueChange={setIsPaused}
                  trackColor={{
                    false: theme.pillBg,
                    true: theme.accentPrimary,
                  }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {isPaused ? (
                <View style={styles.chipsWrap}>
                  {(
                    [
                      { key: 'indefinite' as const, label: 'Indefinido' },
                      { key: '3d' as const, label: '3 días' },
                      { key: '7d' as const, label: '7 días' },
                      { key: '14d' as const, label: '14 días' },
                    ]
                  ).map((dur) => {
                    const active = pauseDuration === dur.key;
                    return (
                      <Pressable
                        key={dur.key}
                        onPress={() => setPauseDuration(dur.key)}
                        style={[
                          styles.unitChip,
                          {
                            backgroundColor: active
                              ? theme.accentPrimarySoft
                              : theme.inputBg,
                            borderColor: active
                              ? theme.accentPrimaryBorder
                              : theme.glassBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.unitChipText,
                            {
                              color: active
                                ? theme.accentPrimaryLink
                                : theme.textSecondary,
                            },
                          ]}
                        >
                          {dur.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>

            {/* Footer Acciones */}
            <View style={styles.footerActions}>
              {habitToEdit && onDelete ? (
                <Pressable
                  onPress={() => {
                    onDelete(habitToEdit.id);
                    onClose();
                  }}
                  style={[
                    styles.deleteBtn,
                    {
                      backgroundColor: theme.dangerSoft,
                      borderColor: theme.glassBorder,
                    },
                  ]}
                  accessibilityLabel="Eliminar hábito"
                >
                  <Trash2 size={17} color={theme.danger} strokeWidth={2} />
                </Pressable>
              ) : null}

              <Pressable
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.saveBtn,
                  { backgroundColor: theme.accentPrimary },
                  !title.trim() && { opacity: 0.45 },
                  pressed && { opacity: 0.88 },
                ]}
              >
                <Text style={[styles.saveBtnText, { color: theme.accentPrimaryText }]}>
                  {habitToEdit ? 'Guardar Cambios' : 'Crear Hábito'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
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
    paddingVertical: spacing.lg,
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 580,
    maxHeight: '90%',
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
    gap: spacing.sm,
  },
  sheetTitle: {
    fontSize: 18,
    ...typography.cardTitle,
  },
  sheetSub: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBlock: {
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 44,
    fontSize: 14,
    fontWeight: '500',
  },
  segmentBox: {
    flexDirection: 'row',
    borderRadius: radii.md,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: radii.squircle,
    paddingVertical: 9,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  quantBox: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  quantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  quantSub: {
    fontSize: 12,
    marginTop: 1,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  unitChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  unitChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  unitInput: {
    minWidth: 84,
    height: 30,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 12,
    fontWeight: '600',
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 4,
  },
  dayCircle: {
    flex: 1,
    height: 38,
    maxWidth: 48,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  iconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: radii.squircle,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  pauseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pauseTitleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  deleteBtn: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    flex: 1,
    height: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

export default HabitEditorSheet;
