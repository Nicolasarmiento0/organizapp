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
  useWindowDimensions,
  View,
} from 'react-native';
import type {
  WorkBlockAlertMinutes,
  WorkBlockRecord,
  WorkBlockType,
} from '@organiza/shared/schema';
import {
  Bell,
  Briefcase,
  Calendar,
  Clock,
  MapPin,
  Trash2,
  X,
  Zap,
} from '../../components/icons';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import { iconMetrics, radii, shadows, spacing, typography } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import {
  ALERT_OPTIONS,
  CALENDAR_COLORS,
  SHIFT_COLOR_SWATCHES,
  hexWithAlpha,
  minutesToTime,
  normalizeHexColor,
  parseTimeInputSafe,
  parseTimeToMinutes,
  triggerCalendarHaptic,
} from './calendarUtils';

export interface CalendarEventModalProps {
  visible: boolean;
  dateKey: string;
  editingBlock: WorkBlockRecord | null;
  initialStartTime?: string;
  initialEndTime?: string;
  initialAllDay?: boolean;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    title: string;
    blockType: WorkBlockType;
    startTime: string;
    endTime: string;
    isAllDay: boolean;
    alertMinutesBefore: WorkBlockAlertMinutes | null;
    color: string | null;
    locationOrLink: string;
  }) => void;
  onDelete?: (blockId: string) => void;
}

const EVENT_TYPES: ReadonlyArray<{
  key: WorkBlockType;
  label: string;
  color: string;
}> = [
  { key: 'personal', label: 'Evento', color: CALENDAR_COLORS.coral },
  { key: 'deep_work', label: 'Deep Work', color: CALENDAR_COLORS.coral },
  { key: 'meeting', label: 'Reunión', color: '#F59E0B' },
  { key: 'work_shift', label: 'Turno', color: CALENDAR_COLORS.shiftPurple },
  { key: 'break', label: 'Día Libre', color: CALENDAR_COLORS.habitEmerald },
];

const DURATION_CHIPS: ReadonlyArray<{ label: string; minutes: number }> = [
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '2h', minutes: 120 },
];

export const CalendarEventModal: React.FC<CalendarEventModalProps> = ({
  visible,
  dateKey,
  editingBlock,
  initialStartTime = '10:00',
  initialEndTime = '11:00',
  initialAllDay = false,
  onClose,
  onSave,
  onDelete,
}) => {
  const { theme, isDark } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const sheetMaxHeight = Math.max(380, Math.round(windowHeight * 0.86));
  const scrollMaxHeight = Math.max(180, sheetMaxHeight - 190);
  const [title, setTitle] = useState('');
  const [blockType, setBlockType] = useState<WorkBlockType>('personal');
  const [isAllDay, setIsAllDay] = useState(false);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [alertMinutesBefore, setAlertMinutesBefore] =
    useState<WorkBlockAlertMinutes | null>(15);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [customHexInput, setCustomHexInput] = useState('');
  const [locationOrLink, setLocationOrLink] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (editingBlock) {
      setTitle(editingBlock.title);
      setBlockType(editingBlock.blockType);
      setIsAllDay(Boolean(editingBlock.isAllDay));
      setStartTime(editingBlock.startTime);
      setEndTime(editingBlock.endTime);
      const alertVal = editingBlock.alertMinutesBefore;
      setAlertMinutesBefore(
        alertVal === 0 || alertVal === 15 || alertVal === 60 ? alertVal : null
      );
      setSelectedColor(editingBlock.color ?? null);
      setCustomHexInput(editingBlock.color ?? '');
      setLocationOrLink(editingBlock.locationOrLink ?? '');
    } else {
      setTitle('');
      setBlockType('personal');
      setIsAllDay(initialAllDay);
      setStartTime(initialStartTime);
      setEndTime(initialEndTime);
      setAlertMinutesBefore(15);
      setSelectedColor(null);
      setCustomHexInput('');
      setLocationOrLink('');
    }
  }, [visible, editingBlock, initialStartTime, initialEndTime, initialAllDay]);

  const applyDurationChip = (durationMins: number) => {
    triggerCalendarHaptic('selection');
    const cleanStart = parseTimeInputSafe(startTime, '09:00');
    const startMins = parseTimeToMinutes(cleanStart);
    const nextEnd = (startMins + durationMins) % (24 * 60);
    setStartTime(cleanStart);
    setEndTime(minutesToTime(nextEnd));
  };

  const crossesMidnight =
    !isAllDay &&
    parseTimeToMinutes(parseTimeInputSafe(endTime, '10:00')) <
      parseTimeToMinutes(parseTimeInputSafe(startTime, '09:00'));

  const handleSubmit = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    const cleanStart = parseTimeInputSafe(startTime, '09:00');
    let cleanEnd = parseTimeInputSafe(endTime, '10:00');
    if (parseTimeToMinutes(cleanEnd) === parseTimeToMinutes(cleanStart)) {
      cleanEnd = minutesToTime((parseTimeToMinutes(cleanStart) + 30) % (24 * 60));
    }

    triggerCalendarHaptic('success');
    onSave({
      id: editingBlock?.id,
      title: cleanTitle,
      blockType,
      startTime: isAllDay ? '00:00' : cleanStart,
      endTime: isAllDay ? '23:59' : cleanEnd,
      isAllDay,
      alertMinutesBefore: isAllDay ? null : alertMinutesBefore,
      color: selectedColor,
      locationOrLink: locationOrLink.trim(),
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
              ? 'rgba(5, 7, 10, 0.72)'
              : 'rgba(15, 17, 21, 0.28)',
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <LiquidGlassCard
          variant="floating"
          intensity={88}
          style={[styles.sheet, { maxHeight: sheetMaxHeight }]}
          contentStyle={styles.sheetContent}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.headerIconBox,
                  {
                    backgroundColor: CALENDAR_COLORS.coralSoft,
                    borderColor: CALENDAR_COLORS.coralBorder,
                  },
                ]}
              >
                <Calendar
                  size={18}
                  color={CALENDAR_COLORS.coral}
                  strokeWidth={2}
                />
              </View>
              <View>
                <Text style={[styles.title, { color: theme.textPrimary }]}>
                  {editingBlock ? 'Editar bloque' : 'Nuevo bloque'}
                </Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  {dateKey}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              {editingBlock && onDelete ? (
                <Pressable
                  onPress={() => {
                    triggerCalendarHaptic('medium');
                    onDelete(editingBlock.id);
                    onClose();
                  }}
                  style={[
                    styles.iconBtn,
                    { backgroundColor: CALENDAR_COLORS.reminderCoralSoft },
                  ]}
                  accessibilityLabel="Eliminar bloque"
                >
                  <Trash2
                    size={16}
                    color={CALENDAR_COLORS.reminderCoral}
                    strokeWidth={iconMetrics.strokeWidth}
                  />
                </Pressable>
              ) : null}
              <Pressable
                onPress={onClose}
                style={[styles.iconBtn, { backgroundColor: theme.pillBg }]}
                accessibilityLabel="Cerrar"
              >
                <X
                  size={16}
                  color={theme.textSecondary}
                  strokeWidth={iconMetrics.strokeWidth}
                />
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={{ maxHeight: scrollMaxHeight }}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            contentContainerStyle={styles.formScroll}
            keyboardShouldPersistTaps="handled"
          >
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Ej. Diseño de producto, Turno o Reunión..."
              placeholderTextColor={theme.textMuted}
              autoFocus={!editingBlock}
              style={[
                styles.titleInput,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.glassBorder,
                  color: theme.textPrimary,
                },
              ]}
            />

            {/* Tipo de Bloque */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                Categoría
              </Text>
              <View style={styles.chipsRow}>
                {EVENT_TYPES.map((t) => {
                  const active = blockType === t.key;
                  const chipColor =
                    selectedColor && active ? selectedColor : t.color;
                  return (
                    <Pressable
                      key={t.key}
                      onPress={() => {
                        triggerCalendarHaptic('selection');
                        setBlockType(t.key);
                      }}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active
                            ? hexWithAlpha(chipColor, 0.16)
                            : theme.inputBg,
                          borderColor: active
                            ? hexWithAlpha(chipColor, 0.45)
                            : theme.glassBorder,
                        },
                      ]}
                    >
                      {t.key === 'work_shift' ? (
                        <Briefcase
                          size={12}
                          color={active ? chipColor : theme.textSecondary}
                          strokeWidth={2}
                        />
                      ) : (
                        <Zap
                          size={12}
                          color={active ? chipColor : theme.textSecondary}
                          strokeWidth={2}
                        />
                      )}
                      <Text
                        style={[
                          styles.chipText,
                          { color: active ? chipColor : theme.textSecondary },
                          active && { fontWeight: '700' },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Toggle Todo el Día */}
            <View
              style={[
                styles.switchRow,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.glassBorder,
                },
              ]}
            >
              <View style={styles.switchLeft}>
                <Clock
                  size={15}
                  color={CALENDAR_COLORS.coral}
                  strokeWidth={2}
                />
                <Text style={[styles.switchLabel, { color: theme.textPrimary }]}>
                  Todo el día
                </Text>
              </View>
              <Switch
                value={isAllDay}
                onValueChange={(val) => {
                  triggerCalendarHaptic('selection');
                  setIsAllDay(val);
                }}
                trackColor={{
                  false: theme.pillBg,
                  true: CALENDAR_COLORS.coral,
                }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Horarios + Duración rápida */}
            {!isAllDay ? (
              <View style={styles.sectionBlock}>
                <View style={styles.timeRow}>
                  <View style={styles.timeCol}>
                    <Text
                      style={[styles.smallLabel, { color: theme.textSecondary }]}
                    >
                      Inicio (HH:mm)
                    </Text>
                    <TextInput
                      value={startTime}
                      onChangeText={setStartTime}
                      placeholder="09:00"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="numbers-and-punctuation"
                      style={[
                        styles.timeInput,
                        {
                          backgroundColor: theme.inputBg,
                          borderColor: theme.glassBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.timeCol}>
                    <Text
                      style={[styles.smallLabel, { color: theme.textSecondary }]}
                    >
                      Fin (HH:mm)
                    </Text>
                    <TextInput
                      value={endTime}
                      onChangeText={setEndTime}
                      placeholder="10:00"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="numbers-and-punctuation"
                      style={[
                        styles.timeInput,
                        {
                          backgroundColor: theme.inputBg,
                          borderColor: theme.glassBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.chipsRow}>
                  {DURATION_CHIPS.map((d) => (
                    <Pressable
                      key={d.label}
                      onPress={() => applyDurationChip(d.minutes)}
                      style={[
                        styles.durationChip,
                        {
                          backgroundColor: theme.pillBg,
                          borderColor: theme.glassBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.durationChipText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        +{d.label}
                      </Text>
                    </Pressable>
                  ))}
                  {crossesMidnight ? (
                    <View
                      style={[
                        styles.overnightBadge,
                        {
                          backgroundColor: CALENDAR_COLORS.shiftPurpleSoft,
                          borderColor: CALENDAR_COLORS.shiftPurpleBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.overnightBadgeText,
                          { color: CALENDAR_COLORS.shiftPurple },
                        ]}
                      >
                        Cruza medianoche (+1 día)
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Alertas Locales Escalonadas ($0 USD) */}
            {!isAllDay ? (
              <View style={styles.sectionBlock}>
                <View style={styles.labelWithIcon}>
                  <Bell
                    size={12}
                    color={theme.textSecondary}
                    strokeWidth={2}
                  />
                  <Text
                    style={[styles.sectionLabel, { color: theme.textSecondary }]}
                  >
                    Alerta local ($0)
                  </Text>
                </View>
                <View style={styles.chipsRow}>
                  {ALERT_OPTIONS.map((opt) => {
                    const active = alertMinutesBefore === opt.value;
                    return (
                      <Pressable
                        key={String(opt.value)}
                        onPress={() => {
                          triggerCalendarHaptic('selection');
                          setAlertMinutesBefore(opt.value);
                        }}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: active
                              ? CALENDAR_COLORS.coralSoft
                              : theme.inputBg,
                            borderColor: active
                              ? CALENDAR_COLORS.coralBorder
                              : theme.glassBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color: active
                                ? CALENDAR_COLORS.coral
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
            ) : null}

            {/* Color de barra lateral */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                Color de bloque / etiqueta
              </Text>
              <View style={[styles.swatchesRow, { flexWrap: 'wrap' }]}>
                <Pressable
                  onPress={() => {
                    setSelectedColor(null);
                    setCustomHexInput('');
                  }}
                  style={[
                    styles.autoSwatch,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor:
                        selectedColor === null
                          ? CALENDAR_COLORS.coral
                          : theme.glassBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.autoSwatchText,
                      {
                        color:
                          selectedColor === null
                            ? CALENDAR_COLORS.coral
                            : theme.textSecondary,
                      },
                    ]}
                  >
                    Auto
                  </Text>
                </Pressable>
                {SHIFT_COLOR_SWATCHES.map((swatch) => {
                  const active =
                    selectedColor?.toUpperCase() === swatch.toUpperCase();
                  return (
                    <Pressable
                      key={swatch}
                      onPress={() => {
                        triggerCalendarHaptic('selection');
                        setSelectedColor(swatch);
                        setCustomHexInput(swatch);
                      }}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: swatch },
                        active && styles.colorSwatchActive,
                      ]}
                    />
                  );
                })}
                <TextInput
                  value={customHexInput}
                  onChangeText={(val) => {
                    setCustomHexInput(val);
                    const normalized = normalizeHexColor(val);
                    if (normalized) {
                      setSelectedColor(normalized);
                    }
                  }}
                  placeholder="#HEX"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="characters"
                  maxLength={7}
                  style={[
                    styles.hexInput,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.glassBorder,
                      color: theme.textPrimary,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Ubicación o nota */}
            <View
              style={[
                styles.locationBox,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.glassBorder,
                },
              ]}
            >
              <MapPin size={15} color={theme.textMuted} strokeWidth={1.8} />
              <TextInput
                value={locationOrLink}
                onChangeText={setLocationOrLink}
                placeholder="Ubicación, enlace Meet o nota breve..."
                placeholderTextColor={theme.textMuted}
                style={[styles.locationInput, { color: theme.textPrimary }]}
              />
            </View>
          </ScrollView>

          <Pressable
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: CALENDAR_COLORS.coral },
              !title.trim() && { opacity: 0.45 },
              pressed && { opacity: 0.88 },
            ]}
          >
            <Text style={styles.saveBtnText}>
              {editingBlock ? 'Guardar cambios' : 'Crear en calendario'}
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
  sheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
    alignSelf: 'center',
    borderRadius: radii.xl,
    ...shadows.modal,
  },
  sheetContent: {
    padding: spacing.lg,
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
    gap: spacing.sm,
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.squircle,
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
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formScroll: {
    gap: spacing.md,
    paddingBottom: 4,
  },
  titleInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 46,
    fontSize: 15,
    fontWeight: '600',
  },
  sectionBlock: {
    gap: 6,
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  switchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timeCol: {
    flex: 1,
    gap: 4,
  },
  smallLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: radii.squircle,
    paddingHorizontal: spacing.md,
    height: 40,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  durationChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  durationChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  overnightBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  overnightBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  hexInput: {
    width: 78,
    height: 28,
    borderWidth: 1,
    borderRadius: radii.squircle,
    paddingHorizontal: 8,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  swatchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoSwatch: {
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoSwatchText: {
    fontSize: 11,
    fontWeight: '700',
  },
  colorSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  colorSwatchActive: {
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.12 }],
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 42,
  },
  locationInput: {
    flex: 1,
    fontSize: 13,
  },
  saveBtn: {
    borderRadius: radii.md,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default CalendarEventModal;
