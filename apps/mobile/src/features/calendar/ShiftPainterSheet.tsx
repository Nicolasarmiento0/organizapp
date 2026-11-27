import React, { useEffect, useMemo, useState } from 'react';
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
  ShiftTemplateRecord,
  WorkBlockAlertMinutes,
  WorkBlockRecord,
} from '@organiza/shared/schema';
import {
  Briefcase,
  Calendar,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  X,
} from '../../components/icons';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import { iconMetrics, radii, shadows, spacing, typography } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import {
  ALERT_OPTIONS,
  CALENDAR_COLORS,
  DEFAULT_ROTATION_6X4_CONFIG,
  ROTATION_6X4_CYCLE_STEPS,
  SHIFT_COLOR_SWATCHES,
  computeRestPeriodsFromRotationConfig,
  diffDaysInclusive,
  getWeekDaysFromAnchor,
  hexWithAlpha,
  normalizeHexColor,
  parseTimeInputSafe,
  shiftDateKeyLocal,
  triggerCalendarHaptic,
  type RestPeriodWindow,
  type Rotation6x4Config,
  type Rotation6x4SlotConfig,
} from './calendarUtils';
import type { CreateShiftTemplateInput } from './useCalendarSchedule';

export interface ShiftPainterSheetProps {
  visible: boolean;
  selectedDateKey: string;
  todayKey: string;
  templates: ShiftTemplateRecord[];
  upcomingRestPeriods: RestPeriodWindow[];
  getShiftBlockForDate: (dateKey: string) => WorkBlockRecord | null;
  onSeedDefaults: () => void;
  onCreateTemplate: (input: CreateShiftTemplateInput) => ShiftTemplateRecord;
  onUpdateTemplate: (
    templateId: string,
    patch: Partial<CreateShiftTemplateInput>,
    alsoUpdateExistingBlocks?: boolean
  ) => void;
  onDeleteTemplate: (templateId: string) => void;
  onPaintDay: (templateIdOrErase: string, dateKey: string) => void;
  onPaintWeekdays: (templateIdOrErase: string, weekDateKeys: string[]) => void;
  onApplyRotation6x4: (config: Rotation6x4Config) => {
    createdShifts: number;
    createdRestDays: number;
    clearedCount: number;
  };
  onClearFutureShifts: (startDateKey: string, horizonDays?: number) => number;
  onJumpToDate: (dateKey: string) => void;
  onClose: () => void;
}

type SheetTab = 'rotation_6x4' | 'rest_days' | 'painter';

export const ShiftPainterSheet: React.FC<ShiftPainterSheetProps> = ({
  visible,
  selectedDateKey,
  todayKey,
  templates,
  upcomingRestPeriods,
  getShiftBlockForDate,
  onSeedDefaults,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onPaintDay,
  onPaintWeekdays,
  onApplyRotation6x4,
  onClearFutureShifts,
  onJumpToDate,
  onClose,
}) => {
  const { theme, isDark } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const sheetMaxHeight = Math.max(380, Math.round(windowHeight * 0.86));
  const scrollMaxHeightWithFooter = Math.max(180, sheetMaxHeight - 236);
  const scrollMaxHeightSimple = Math.max(200, sheetMaxHeight - 152);
  const [activeTab, setActiveTab] = useState<SheetTab>('rotation_6x4');

  // --- Estado Plantillas y Pintor Semanal ---
  const [activeBrushId, setActiveBrushId] = useState<string>('erase');
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null
  );
  const [alsoUpdateExisting, setAlsoUpdateExisting] = useState(true);
  const [tplName, setTplName] = useState('');
  const [tplStart, setTplStart] = useState('08:00');
  const [tplEnd, setTplEnd] = useState('17:00');
  const [tplColor, setTplColor] = useState<string>(SHIFT_COLOR_SWATCHES[0]);
  const [tplHexInput, setTplHexInput] = useState<string>(
    SHIFT_COLOR_SWATCHES[0]
  );
  const [tplAlert, setTplAlert] = useState<WorkBlockAlertMinutes | null>(60);

  // --- Estado Bloque de Trabajo 6x4 (Rango libre hasta 2 años, por defecto 1 año) ---
  const [rotationConfig, setRotationConfig] = useState<Rotation6x4Config>(() =>
    DEFAULT_ROTATION_6X4_CONFIG(selectedDateKey)
  );
  const [isCustomHorizon, setIsCustomHorizon] = useState(false);
  const [customEndDateInput, setCustomEndDateInput] = useState(() =>
    shiftDateKeyLocal(selectedDateKey, 364)
  );
  const [customDaysInput, setCustomDaysInput] = useState('365');

  useEffect(() => {
    if (visible && templates.length === 0) {
      onSeedDefaults();
    }
  }, [visible, templates.length, onSeedDefaults]);

  useEffect(() => {
    if (visible && templates.length > 0 && activeBrushId === 'erase') {
      setActiveBrushId(templates[0]!.id);
    }
  }, [visible, templates, activeBrushId]);

  useEffect(() => {
    if (visible) {
      setRotationConfig((prev) => ({
        ...prev,
        startDateKey: selectedDateKey,
      }));
      setCustomEndDateInput(
        shiftDateKeyLocal(selectedDateKey, Math.max(0, rotationConfig.horizonDays - 1))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, selectedDateKey]);

  const weekDays = useMemo(
    () => getWeekDaysFromAnchor(selectedDateKey, todayKey),
    [selectedDateKey, todayKey]
  );
  const weekDateKeys = useMemo(() => weekDays.map((d) => d.dateKey), [weekDays]);

  const previewRestPeriods = useMemo(
    () => computeRestPeriodsFromRotationConfig(rotationConfig, todayKey),
    [rotationConfig, todayKey]
  );

  const rotationSummary = useMemo(() => {
    const horizon = Math.max(
      1,
      Math.min(730, Math.round(rotationConfig.horizonDays || 365))
    );
    let workDays = 0;
    let restDays = 0;
    for (let i = 0; i < horizon; i += 1) {
      const pos = (i + rotationConfig.cycleStartDayIndex) % 10;
      if (pos < 6) workDays += 1;
      else restDays += 1;
    }
    return {
      horizon,
      workDays,
      restDays,
      restBlocksCount: previewRestPeriods.length,
    };
  }, [
    rotationConfig.cycleStartDayIndex,
    rotationConfig.horizonDays,
    previewRestPeriods.length,
  ]);

  const openNewTemplateForm = () => {
    setEditingTemplateId(null);
    setTplName('');
    setTplStart('08:00');
    setTplEnd('17:00');
    setTplColor(SHIFT_COLOR_SWATCHES[0]);
    setTplHexInput(SHIFT_COLOR_SWATCHES[0]);
    setTplAlert(60);
    setShowTemplateForm(true);
  };

  const openEditTemplateForm = (tpl: ShiftTemplateRecord) => {
    setEditingTemplateId(tpl.id);
    setTplName(tpl.name);
    setTplStart(tpl.startTime);
    setTplEnd(tpl.endTime);
    setTplColor(tpl.color);
    setTplHexInput(tpl.color);
    const alertVal = tpl.alertMinutesBefore;
    setTplAlert(
      alertVal === 0 || alertVal === 15 || alertVal === 60 ? alertVal : null
    );
    setAlsoUpdateExisting(true);
    setShowTemplateForm(true);
  };

  const handleSaveTemplate = () => {
    const clean = tplName.trim();
    if (!clean) return;
    const payload: CreateShiftTemplateInput = {
      name: clean,
      startTime: parseTimeInputSafe(tplStart, '08:00'),
      endTime: parseTimeInputSafe(tplEnd, '17:00'),
      color: tplColor,
      alertMinutesBefore: tplAlert,
      locationOrLink: 'Turno programado',
    };

    if (editingTemplateId) {
      onUpdateTemplate(editingTemplateId, payload, alsoUpdateExisting);
      triggerCalendarHaptic('success');
      setActiveBrushId(editingTemplateId);
    } else {
      const created = onCreateTemplate(payload);
      triggerCalendarHaptic('success');
      setActiveBrushId(created.id);
    }
    setShowTemplateForm(false);
    setEditingTemplateId(null);
  };

  const updateRotationSlot = (
    slotKey: 'morning' | 'afternoon' | 'night',
    patch: Partial<Rotation6x4SlotConfig>
  ) => {
    setRotationConfig((prev) => ({
      ...prev,
      [slotKey]: {
        ...prev[slotKey],
        ...patch,
      },
    }));
  };

  const selectPresetHorizon = (days: number) => {
    triggerCalendarHaptic('selection');
    setIsCustomHorizon(false);
    setRotationConfig((prev) => {
      setCustomDaysInput(String(days));
      setCustomEndDateInput(
        shiftDateKeyLocal(prev.startDateKey, Math.max(0, days - 1))
      );
      return { ...prev, horizonDays: days };
    });
  };

  const handleCustomEndDateChange = (val: string) => {
    setCustomEndDateInput(val);
    if (/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
      const days = Math.min(
        730,
        Math.max(1, diffDaysInclusive(rotationConfig.startDateKey, val.trim()))
      );
      setCustomDaysInput(String(days));
      setRotationConfig((prev) => ({ ...prev, horizonDays: days }));
    }
  };

  const handleCustomDaysChange = (val: string) => {
    setCustomDaysInput(val);
    const parsed = Number(val.replace(/[^0-9]/g, ''));
    if (Number.isFinite(parsed) && parsed >= 1) {
      const clamped = Math.min(730, Math.round(parsed));
      setRotationConfig((prev) => {
        setCustomEndDateInput(
          shiftDateKeyLocal(prev.startDateKey, Math.max(0, clamped - 1))
        );
        return { ...prev, horizonDays: clamped };
      });
    }
  };

  const handleApply6x4 = () => {
    const cleanStartDate = /^\d{4}-\d{2}-\d{2}$/.test(
      rotationConfig.startDateKey.trim()
    )
      ? rotationConfig.startDateKey.trim()
      : selectedDateKey;

    onApplyRotation6x4({
      ...rotationConfig,
      startDateKey: cleanStartDate,
      morning: {
        ...rotationConfig.morning,
        startTime: parseTimeInputSafe(rotationConfig.morning.startTime, '06:00'),
        endTime: parseTimeInputSafe(rotationConfig.morning.endTime, '14:00'),
      },
      afternoon: {
        ...rotationConfig.afternoon,
        startTime: parseTimeInputSafe(
          rotationConfig.afternoon.startTime,
          '14:00'
        ),
        endTime: parseTimeInputSafe(rotationConfig.afternoon.endTime, '22:00'),
      },
      night: {
        ...rotationConfig.night,
        startTime: parseTimeInputSafe(rotationConfig.night.startTime, '22:00'),
        endTime: parseTimeInputSafe(rotationConfig.night.endTime, '06:00'),
      },
    });
    onClose();
  };

  const displayedRestWindows =
    upcomingRestPeriods.length > 0 ? upcomingRestPeriods : previewRestPeriods;
  const showingSavedRestWindows = upcomingRestPeriods.length > 0;

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
          {/* Cabecera */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.headerBadge,
                  {
                    backgroundColor: CALENDAR_COLORS.coralSoft,
                    borderColor: CALENDAR_COLORS.coralBorder,
                  },
                ]}
              >
                <Briefcase
                  size={18}
                  color={CALENDAR_COLORS.coral}
                  strokeWidth={2}
                />
              </View>
              <View>
                <Text style={[styles.title, { color: theme.textPrimary }]}>
                  Bloque de Trabajo 6×4 & Turnos
                </Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  2 Mañanas · 2 Tardes · 2 Noches · 4 Libres
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.pillBg }]}
              accessibilityLabel="Cerrar gestor de turnos"
            >
              <X
                size={16}
                color={theme.textSecondary}
                strokeWidth={iconMetrics.strokeWidth}
              />
            </Pressable>
          </View>

          {/* Selector de 3 Pestañas */}
          <View
            style={[
              styles.tabsBar,
              { backgroundColor: theme.inputBg, borderColor: theme.glassBorder },
            ]}
          >
            {(
              [
                { key: 'rotation_6x4' as const, label: 'Bloque 6×4' },
                {
                  key: 'rest_days' as const,
                  label: `Días Libres (${displayedRestWindows.length})`,
                },
                { key: 'painter' as const, label: 'Plantillas' },
              ] as const
            ).map((t) => {
              const active = activeTab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => {
                    triggerCalendarHaptic('selection');
                    setActiveTab(t.key);
                  }}
                  style={[
                    styles.tabBtn,
                    active && { backgroundColor: CALENDAR_COLORS.coral },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      { color: active ? '#FFFFFF' : theme.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {activeTab === 'rotation_6x4' ? (
            <>
              <ScrollView
                style={{ maxHeight: scrollMaxHeightWithFooter }}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                contentContainerStyle={styles.scrollBody}
                keyboardShouldPersistTaps="handled"
              >
              {/* Patrón 10 días */}
              <View
                style={[
                  styles.previewBanner,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                <Text
                  style={[styles.sectionLabel, { color: theme.textSecondary }]}
                >
                  ¿En qué día del ciclo empiezas el {rotationConfig.startDateKey}?
                </Text>
                <View style={styles.cyclePreviewRow}>
                  {ROTATION_6X4_CYCLE_STEPS.map((step) => {
                    const activeStart =
                      rotationConfig.cycleStartDayIndex === step.index;
                    const stepColor =
                      step.slotKey === 'morning'
                        ? rotationConfig.morning.color
                        : step.slotKey === 'afternoon'
                          ? rotationConfig.afternoon.color
                          : step.slotKey === 'night'
                            ? rotationConfig.night.color
                            : rotationConfig.rest.color;

                    return (
                      <Pressable
                        key={step.code}
                        onPress={() => {
                          triggerCalendarHaptic('selection');
                          setRotationConfig((prev) => ({
                            ...prev,
                            cycleStartDayIndex: step.index,
                          }));
                        }}
                        style={[
                          styles.cycleBadge,
                          {
                            backgroundColor: hexWithAlpha(stepColor, 0.16),
                            borderColor: activeStart ? '#FFFFFF' : stepColor,
                          },
                          activeStart && { borderWidth: 2 },
                        ]}
                      >
                        <Text
                          style={[styles.cycleBadgeText, { color: stepColor }]}
                        >
                          {step.code}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={[styles.cycleHint, { color: theme.textMuted }]}>
                  Inicio seleccionado:{' '}
                  <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>
                    {
                      ROTATION_6X4_CYCLE_STEPS[
                        rotationConfig.cycleStartDayIndex
                      ]?.label
                    }
                  </Text>
                </Text>
              </View>

              {/* Rango de fechas: inicio + presets + rango personalizado */}
              <View style={styles.rotationMetaRow}>
                <View style={styles.rotationDateCol}>
                  <Text
                    style={[styles.smallLabel, { color: theme.textSecondary }]}
                  >
                    Fecha inicio
                  </Text>
                  <TextInput
                    value={rotationConfig.startDateKey}
                    onChangeText={(val) =>
                      setRotationConfig((prev) => ({
                        ...prev,
                        startDateKey: val,
                      }))
                    }
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor={theme.textMuted}
                    style={[
                      styles.creatorInput,
                      {
                        backgroundColor: theme.inputBg,
                        borderColor: theme.glassBorder,
                        color: theme.textPrimary,
                      },
                    ]}
                  />
                </View>

                <View style={styles.rotationHorizonCol}>
                  <Text
                    style={[styles.smallLabel, { color: theme.textSecondary }]}
                  >
                    Rango a proyectar
                  </Text>
                  <View style={styles.horizonRow}>
                    {(
                      [
                        { days: 30, label: '1m' },
                        { days: 90, label: '3m' },
                        { days: 180, label: '6m' },
                        { days: 365, label: '1 Año' },
                      ] as const
                    ).map((opt) => {
                      const active =
                        !isCustomHorizon &&
                        rotationConfig.horizonDays === opt.days;
                      return (
                        <Pressable
                          key={opt.days}
                          onPress={() => selectPresetHorizon(opt.days)}
                          style={[
                            styles.horizonChip,
                            {
                              backgroundColor: active
                                ? CALENDAR_COLORS.coral
                                : theme.inputBg,
                              borderColor: active
                                ? CALENDAR_COLORS.coral
                                : theme.glassBorder,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.horizonChipText,
                              {
                                color: active ? '#FFFFFF' : theme.textSecondary,
                              },
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}

                    <Pressable
                      onPress={() => {
                        triggerCalendarHaptic('selection');
                        setIsCustomHorizon((prev) => !prev);
                      }}
                      style={[
                        styles.horizonChip,
                        {
                          backgroundColor: isCustomHorizon
                            ? CALENDAR_COLORS.coral
                            : theme.inputBg,
                          borderColor: isCustomHorizon
                            ? CALENDAR_COLORS.coral
                            : theme.glassBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.horizonChipText,
                          {
                            color: isCustomHorizon
                              ? '#FFFFFF'
                              : theme.textSecondary,
                          },
                        ]}
                      >
                        Otro
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {isCustomHorizon ? (
                <View
                  style={[
                    styles.customRangeBox,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: CALENDAR_COLORS.coralBorder,
                    },
                  ]}
                >
                  <View style={styles.customRangeField}>
                    <Text
                      style={[styles.smallLabel, { color: theme.textSecondary }]}
                    >
                      Hasta fecha (AAAA-MM-DD)
                    </Text>
                    <TextInput
                      value={customEndDateInput}
                      onChangeText={handleCustomEndDateChange}
                      placeholder="2027-11-27"
                      placeholderTextColor={theme.textMuted}
                      style={[
                        styles.creatorInput,
                        {
                          backgroundColor: theme.card,
                          borderColor: theme.glassBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.customDaysField}>
                    <Text
                      style={[styles.smallLabel, { color: theme.textSecondary }]}
                    >
                      O días (1–730)
                    </Text>
                    <TextInput
                      value={customDaysInput}
                      onChangeText={handleCustomDaysChange}
                      keyboardType="number-pad"
                      placeholder="365"
                      placeholderTextColor={theme.textMuted}
                      style={[
                        styles.creatorInput,
                        {
                          backgroundColor: theme.card,
                          borderColor: theme.glassBorder,
                          color: theme.textPrimary,
                          textAlign: 'center',
                        },
                      ]}
                    />
                  </View>
                </View>
              ) : null}

              {/* Configuración de 2 Mañanas, 2 Tardes, 2 Noches */}
              {(
                [
                  { key: 'morning' as const, badge: '2 MAÑANAS' },
                  { key: 'afternoon' as const, badge: '2 TARDES' },
                  { key: 'night' as const, badge: '2 NOCHES (Cruza 00:00)' },
                ] as const
              ).map(({ key, badge }) => {
                const slot = rotationConfig[key];
                return (
                  <View
                    key={key}
                    style={[
                      styles.slotCard,
                      {
                        backgroundColor: theme.inputBg,
                        borderColor: hexWithAlpha(slot.color, 0.4),
                      },
                    ]}
                  >
                    <View style={styles.slotHeaderRow}>
                      <View
                        style={[
                          styles.slotBadge,
                          { backgroundColor: slot.color },
                        ]}
                      >
                        <Text style={styles.slotBadgeText}>{badge}</Text>
                      </View>
                      <Text
                        style={[styles.slotHoursPreview, { color: slot.color }]}
                      >
                        {slot.startTime} – {slot.endTime}
                      </Text>
                    </View>

                    <View style={styles.slotInputsRow}>
                      <TextInput
                        value={slot.title}
                        onChangeText={(val) =>
                          updateRotationSlot(key, { title: val })
                        }
                        placeholder="Nombre del turno"
                        placeholderTextColor={theme.textMuted}
                        style={[
                          styles.slotTitleInput,
                          {
                            backgroundColor: theme.card,
                            borderColor: theme.glassBorder,
                            color: theme.textPrimary,
                          },
                        ]}
                      />
                      <TextInput
                        value={slot.startTime}
                        onChangeText={(val) =>
                          updateRotationSlot(key, { startTime: val })
                        }
                        placeholder="06:00"
                        placeholderTextColor={theme.textMuted}
                        style={[
                          styles.slotTimeInput,
                          {
                            backgroundColor: theme.card,
                            borderColor: theme.glassBorder,
                            color: theme.textPrimary,
                          },
                        ]}
                      />
                      <TextInput
                        value={slot.endTime}
                        onChangeText={(val) =>
                          updateRotationSlot(key, { endTime: val })
                        }
                        placeholder="14:00"
                        placeholderTextColor={theme.textMuted}
                        style={[
                          styles.slotTimeInput,
                          {
                            backgroundColor: theme.card,
                            borderColor: theme.glassBorder,
                            color: theme.textPrimary,
                          },
                        ]}
                      />
                    </View>

                    <View style={styles.swatchesRow}>
                      {SHIFT_COLOR_SWATCHES.map((swatch) => (
                        <Pressable
                          key={swatch}
                          onPress={() => {
                            triggerCalendarHaptic('selection');
                            updateRotationSlot(key, { color: swatch });
                          }}
                          style={[
                            styles.swatchDotSmall,
                            { backgroundColor: swatch },
                            slot.color.toUpperCase() === swatch.toUpperCase() &&
                              styles.swatchDotActive,
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                );
              })}

              {/* Tarjeta 4 Días Libres */}
              <View
                style={[
                  styles.slotCard,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: hexWithAlpha(rotationConfig.rest.color, 0.4),
                  },
                ]}
              >
                <View style={styles.slotHeaderRow}>
                  <View
                    style={[
                      styles.slotBadge,
                      { backgroundColor: rotationConfig.rest.color },
                    ]}
                  >
                    <Text style={styles.slotBadgeText}>4 DÍAS LIBRES</Text>
                  </View>
                  <Switch
                    value={rotationConfig.rest.enabled}
                    onValueChange={(val) => {
                      triggerCalendarHaptic('selection');
                      setRotationConfig((prev) => ({
                        ...prev,
                        rest: { ...prev.rest, enabled: val },
                      }));
                    }}
                    trackColor={{
                      false: theme.pillBg,
                      true: rotationConfig.rest.color,
                    }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <Text
                  style={[styles.restExplainText, { color: theme.textSecondary }]}
                >
                  Marca automáticamente cada descanso de 4 días en tu calendario
                  para visualizar tus próximos días libres.
                </Text>

                {rotationConfig.rest.enabled ? (
                  <View style={styles.swatchesRow}>
                    {SHIFT_COLOR_SWATCHES.map((swatch) => (
                      <Pressable
                        key={swatch}
                        onPress={() => {
                          triggerCalendarHaptic('selection');
                          setRotationConfig((prev) => ({
                            ...prev,
                            rest: { ...prev.rest, color: swatch },
                          }));
                        }}
                        style={[
                          styles.swatchDotSmall,
                          { backgroundColor: swatch },
                          rotationConfig.rest.color.toUpperCase() ===
                            swatch.toUpperCase() && styles.swatchDotActive,
                        ]}
                      />
                    ))}
                  </View>
                ) : null}
              </View>

              {/* Alerta local antes de cada turno */}
              <View style={styles.sectionBlock}>
                <Text
                  style={[styles.sectionLabel, { color: theme.textSecondary }]}
                >
                  Alerta local antes de cada turno ($0)
                </Text>
                <View style={styles.alertRow}>
                  {ALERT_OPTIONS.map((opt) => {
                    const active =
                      rotationConfig.alertMinutesBefore === opt.value;
                    return (
                      <Pressable
                        key={String(opt.value)}
                        onPress={() =>
                          setRotationConfig((prev) => ({
                            ...prev,
                            alertMinutesBefore: opt.value,
                          }))
                        }
                        style={[
                          styles.alertChip,
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
                            styles.alertChipText,
                            {
                              color: active
                                ? CALENDAR_COLORS.coral
                                : theme.textSecondary,
                            },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              </ScrollView>

              {/* Pie fijo con resumen y acción principal */}
              <View
                style={[
                  styles.stickyFooter,
                  { borderTopColor: theme.divider },
                ]}
              >
                <Text
                  style={[styles.summaryFooterText, { color: theme.textSecondary }]}
                >
                  Resumen: {rotationSummary.horizon} días ·{' '}
                  {rotationSummary.workDays} turnos · {rotationSummary.restDays}{' '}
                  días libres ({rotationSummary.restBlocksCount} bloques)
                </Text>

                <View style={styles.bulkActionsRow}>
                  <Pressable
                    onPress={handleApply6x4}
                    style={[
                      styles.bulkBtn,
                      { backgroundColor: CALENDAR_COLORS.coral },
                    ]}
                  >
                    <Text style={styles.bulkBtnPrimaryText}>
                      Agregar bloque de trabajo 6×4
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      onClearFutureShifts(
                        rotationConfig.startDateKey,
                        rotationConfig.horizonDays
                      );
                    }}
                    style={[
                      styles.clearBtn,
                      {
                        backgroundColor: CALENDAR_COLORS.coralSoft,
                        borderColor: CALENDAR_COLORS.coralBorder,
                      },
                    ]}
                    accessibilityLabel="Limpiar turnos y días libres del rango"
                  >
                    <Trash2
                      size={15}
                      color={CALENDAR_COLORS.coral}
                      strokeWidth={2}
                    />
                  </Pressable>
                </View>
              </View>
            </>
          ) : activeTab === 'rest_days' ? (
            <ScrollView
              style={{ maxHeight: scrollMaxHeightSimple }}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              contentContainerStyle={styles.scrollBody}
            >
              <View
                style={[
                  styles.previewBanner,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                <Text
                  style={[styles.sectionLabel, { color: theme.textSecondary }]}
                >
                  {showingSavedRestWindows
                    ? `Próximos descansos agendados (${displayedRestWindows.length})`
                    : `Vista previa de próximos descansos (${displayedRestWindows.length})`}
                </Text>
                <Text style={[styles.cycleHint, { color: theme.textMuted }]}>
                  {showingSavedRestWindows
                    ? 'Toca cualquier bloque para saltar directamente a ese día libre en tu calendario.'
                    : 'Aún no has guardado tu bloque 6×4. Toca "Bloque 6×4" para guardarlo o explora los rangos proyectados abajo.'}
                </Text>
              </View>

              {displayedRestWindows.map((win) => {
                const whenText =
                  win.daysUntilStart <= 0
                    ? 'En curso ahora'
                    : win.daysUntilStart === 1
                      ? 'Empieza mañana'
                      : `En ${win.daysUntilStart} días`;

                return (
                  <Pressable
                    key={`${win.startDateKey}-${win.endDateKey}`}
                    onPress={() => {
                      triggerCalendarHaptic('selection');
                      onJumpToDate(win.startDateKey);
                      onClose();
                    }}
                    style={[
                      styles.restWindowCard,
                      {
                        backgroundColor: theme.inputBg,
                        borderColor: hexWithAlpha(win.color, 0.38),
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.restIconBox,
                        { backgroundColor: hexWithAlpha(win.color, 0.16) },
                      ]}
                    >
                      <Calendar size={16} color={win.color} strokeWidth={2} />
                    </View>

                    <View style={styles.restWindowTextCol}>
                      <Text
                        style={[
                          styles.restWindowRange,
                          { color: theme.textPrimary },
                        ]}
                      >
                        {win.rangeLabel}
                      </Text>
                      <Text
                        style={[styles.restWindowMeta, { color: win.color }]}
                      >
                        {win.daysCount} {win.daysCount === 1 ? 'día libre' : 'días libres'} · {whenText}
                      </Text>
                    </View>

                    <ChevronRight
                      size={16}
                      color={theme.textMuted}
                      strokeWidth={2}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <ScrollView
              style={{ maxHeight: scrollMaxHeightSimple }}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              contentContainerStyle={styles.scrollBody}
              keyboardShouldPersistTaps="handled"
            >
              {/* Selector de Pincel (Plantillas con botón Editar horario y color) */}
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text
                    style={[styles.sectionLabel, { color: theme.textSecondary }]}
                  >
                    1. Plantillas (edita horario y color)
                  </Text>
                  <Pressable
                    onPress={() =>
                      showTemplateForm
                        ? setShowTemplateForm(false)
                        : openNewTemplateForm()
                    }
                    style={[
                      styles.newTplBtn,
                      {
                        backgroundColor: CALENDAR_COLORS.coralSoft,
                        borderColor: CALENDAR_COLORS.coralBorder,
                      },
                    ]}
                  >
                    <Plus
                      size={12}
                      color={CALENDAR_COLORS.coral}
                      strokeWidth={2.4}
                    />
                    <Text
                      style={[
                        styles.newTplBtnText,
                        { color: CALENDAR_COLORS.coral },
                      ]}
                    >
                      {showTemplateForm ? 'Cancelar' : 'Nueva'}
                    </Text>
                  </Pressable>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.brushesRow}
                >
                  {templates.map((tpl) => {
                    const active = activeBrushId === tpl.id;
                    return (
                      <Pressable
                        key={tpl.id}
                        onPress={() => {
                          triggerCalendarHaptic('selection');
                          setActiveBrushId(tpl.id);
                        }}
                        style={[
                          styles.brushCard,
                          {
                            backgroundColor: active
                              ? hexWithAlpha(tpl.color, 0.16)
                              : theme.inputBg,
                            borderColor: active ? tpl.color : theme.glassBorder,
                          },
                        ]}
                      >
                        <View style={styles.brushTopRow}>
                          <View
                            style={[
                              styles.brushDot,
                              { backgroundColor: tpl.color },
                            ]}
                          />
                          <Text
                            style={[
                              styles.brushName,
                              { color: theme.textPrimary },
                            ]}
                            numberOfLines={1}
                          >
                            {tpl.name}
                          </Text>
                          <Pressable
                            onPress={() => {
                              triggerCalendarHaptic('light');
                              onDeleteTemplate(tpl.id);
                            }}
                            hitSlop={8}
                          >
                            <Trash2
                              size={12}
                              color={theme.textMuted}
                              strokeWidth={2}
                            />
                          </Pressable>
                        </View>

                        <View style={styles.brushBottomRow}>
                          <Text
                            style={[
                              styles.brushTime,
                              { color: active ? tpl.color : theme.textSecondary },
                            ]}
                          >
                            {tpl.startTime} – {tpl.endTime}
                          </Text>
                          <Pressable
                            onPress={() => openEditTemplateForm(tpl)}
                            hitSlop={8}
                            style={[
                              styles.editPillBtn,
                              {
                                backgroundColor: theme.card,
                                borderColor: theme.glassBorder,
                              },
                            ]}
                          >
                            <Pencil
                              size={10}
                              color={theme.textPrimary}
                              strokeWidth={2}
                            />
                            <Text
                              style={[
                                styles.editPillText,
                                { color: theme.textPrimary },
                              ]}
                            >
                              Editar
                            </Text>
                          </Pressable>
                        </View>
                      </Pressable>
                    );
                  })}

                  <Pressable
                    onPress={() => {
                      triggerCalendarHaptic('selection');
                      setActiveBrushId('erase');
                    }}
                    style={[
                      styles.brushCard,
                      {
                        backgroundColor:
                          activeBrushId === 'erase'
                            ? CALENDAR_COLORS.coralSoft
                            : theme.inputBg,
                        borderColor:
                          activeBrushId === 'erase'
                            ? CALENDAR_COLORS.coral
                            : theme.glassBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.brushName,
                        {
                          color:
                            activeBrushId === 'erase'
                              ? CALENDAR_COLORS.coral
                              : theme.textPrimary,
                        },
                      ]}
                    >
                      Quitar turno
                    </Text>
                    <Text
                      style={[styles.brushTime, { color: theme.textSecondary }]}
                    >
                      Dejar libre
                    </Text>
                  </Pressable>
                </ScrollView>
              </View>

              {/* Editor / Creador inline de horario y color */}
              {showTemplateForm ? (
                <View
                  style={[
                    styles.creatorBox,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.glassBorderStrong,
                    },
                  ]}
                >
                  <Text
                    style={[styles.formHeading, { color: theme.textPrimary }]}
                  >
                    {editingTemplateId
                      ? 'Editar horario, nombre y color'
                      : 'Nueva plantilla de turno'}
                  </Text>
                  <TextInput
                    value={tplName}
                    onChangeText={setTplName}
                    placeholder="Nombre del turno (ej. Guardia Noche)"
                    placeholderTextColor={theme.textMuted}
                    style={[
                      styles.creatorInput,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.glassBorder,
                        color: theme.textPrimary,
                      },
                    ]}
                  />
                  <View style={styles.creatorTimeRow}>
                    <View style={styles.timeColField}>
                      <Text
                        style={[
                          styles.smallLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Inicio (HH:mm)
                      </Text>
                      <TextInput
                        value={tplStart}
                        onChangeText={setTplStart}
                        placeholder="08:00"
                        placeholderTextColor={theme.textMuted}
                        style={[
                          styles.creatorTimeInput,
                          {
                            backgroundColor: theme.card,
                            borderColor: theme.glassBorder,
                            color: theme.textPrimary,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.timeColField}>
                      <Text
                        style={[
                          styles.smallLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Fin (HH:mm)
                      </Text>
                      <TextInput
                        value={tplEnd}
                        onChangeText={setTplEnd}
                        placeholder="17:00"
                        placeholderTextColor={theme.textMuted}
                        style={[
                          styles.creatorTimeInput,
                          {
                            backgroundColor: theme.card,
                            borderColor: theme.glassBorder,
                            color: theme.textPrimary,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.swatchesRow}>
                    {SHIFT_COLOR_SWATCHES.map((swatch) => (
                      <Pressable
                        key={swatch}
                        onPress={() => {
                          setTplColor(swatch);
                          setTplHexInput(swatch);
                        }}
                        style={[
                          styles.swatchDot,
                          { backgroundColor: swatch },
                          tplColor.toUpperCase() === swatch.toUpperCase() &&
                            styles.swatchDotActive,
                        ]}
                      />
                    ))}
                    <TextInput
                      value={tplHexInput}
                      onChangeText={(val) => {
                        setTplHexInput(val);
                        const norm = normalizeHexColor(val);
                        if (norm) setTplColor(norm);
                      }}
                      placeholder="#FA6B6B"
                      placeholderTextColor={theme.textMuted}
                      autoCapitalize="characters"
                      maxLength={7}
                      style={[
                        styles.hexMiniInput,
                        {
                          backgroundColor: theme.card,
                          borderColor: theme.glassBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.alertRow}>
                    {ALERT_OPTIONS.map((opt) => {
                      const active = tplAlert === opt.value;
                      return (
                        <Pressable
                          key={String(opt.value)}
                          onPress={() => setTplAlert(opt.value)}
                          style={[
                            styles.alertChip,
                            {
                              backgroundColor: active
                                ? CALENDAR_COLORS.coralSoft
                                : theme.card,
                              borderColor: active
                                ? CALENDAR_COLORS.coral
                                : theme.glassBorder,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.alertChipText,
                              {
                                color: active
                                  ? CALENDAR_COLORS.coral
                                  : theme.textSecondary,
                              },
                            ]}
                          >
                            {opt.shortLabel}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {editingTemplateId ? (
                    <View style={styles.updateExistingRow}>
                      <Text
                        style={[
                          styles.updateExistingLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Aplicar nuevo horario y color a turnos ya agendados
                      </Text>
                      <Switch
                        value={alsoUpdateExisting}
                        onValueChange={setAlsoUpdateExisting}
                        trackColor={{
                          false: theme.pillBg,
                          true: tplColor,
                        }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                  ) : null}

                  <Pressable
                    onPress={handleSaveTemplate}
                    style={[
                      styles.createTplSubmit,
                      { backgroundColor: tplColor },
                      !tplName.trim() && { opacity: 0.45 },
                    ]}
                  >
                    <Text style={styles.createTplSubmitText}>
                      {editingTemplateId
                        ? 'Guardar cambios de plantilla'
                        : 'Guardar plantilla'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {/* Cuadrícula de 7 días para pintar en 1 toque */}
              <View style={styles.sectionBlock}>
                <Text
                  style={[styles.sectionLabel, { color: theme.textSecondary }]}
                >
                  2. Toca los días para pintar la semana
                </Text>

                <View style={styles.daysGrid}>
                  {weekDays.map((day) => {
                    const painted = getShiftBlockForDate(day.dateKey);
                    const shiftColor =
                      painted?.color || CALENDAR_COLORS.coral;

                    return (
                      <Pressable
                        key={day.dateKey}
                        onPress={() => onPaintDay(activeBrushId, day.dateKey)}
                        style={[
                          styles.dayPaintCard,
                          {
                            backgroundColor: painted
                              ? hexWithAlpha(shiftColor, 0.16)
                              : theme.inputBg,
                            borderColor: painted
                              ? hexWithAlpha(shiftColor, 0.45)
                              : theme.glassBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayPaintLetter,
                            {
                              color: day.isToday
                                ? CALENDAR_COLORS.coral
                                : theme.textMuted,
                            },
                          ]}
                        >
                          {day.letter} {day.dayNum}
                        </Text>

                        {painted ? (
                          <>
                            <View
                              style={[
                                styles.paintedPill,
                                { backgroundColor: shiftColor },
                              ]}
                            >
                              <Text
                                style={styles.paintedPillText}
                                numberOfLines={1}
                              >
                                {painted.title}
                              </Text>
                            </View>
                            <Text
                              style={[styles.paintedHours, { color: shiftColor }]}
                            >
                              {painted.startTime}
                            </Text>
                          </>
                        ) : (
                          <Text
                            style={[
                              styles.emptyDayLabel,
                              { color: theme.textMuted },
                            ]}
                          >
                            Libre
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.bulkActionsRow}>
                  <Pressable
                    onPress={() => onPaintWeekdays(activeBrushId, weekDateKeys)}
                    style={[
                      styles.bulkBtn,
                      { backgroundColor: CALENDAR_COLORS.coral },
                    ]}
                  >
                    <Text style={styles.bulkBtnPrimaryText}>
                      {activeBrushId === 'erase'
                        ? 'Limpiar L–V'
                        : 'Pintar L–V en 1 toque'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      for (const dk of weekDateKeys) {
                        onPaintDay('erase', dk);
                      }
                    }}
                    style={[
                      styles.bulkBtn,
                      {
                        backgroundColor: theme.pillBg,
                        borderWidth: 1,
                        borderColor: theme.glassBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.bulkBtnSecondaryText,
                        { color: theme.textPrimary },
                      ]}
                    >
                      Limpiar semana
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          )}
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
    maxWidth: 590,
    maxHeight: '90%',
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
    flex: 1,
  },
  headerBadge: {
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
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsBar: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    height: 34,
    borderRadius: radii.squircle,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollBody: {
    gap: spacing.md,
    paddingBottom: 16,
  },
  stickyFooter: {
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    gap: 8,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  smallLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  newTplBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  newTplBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  brushesRow: {
    gap: 8,
    paddingVertical: 2,
  },
  brushCard: {
    minWidth: 168,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1.5,
    gap: 6,
  },
  brushTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brushBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  brushDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  brushName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  brushTime: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  editPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  editPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  creatorBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 10,
  },
  formHeading: {
    fontSize: 13,
    fontWeight: '700',
  },
  creatorInput: {
    borderWidth: 1,
    borderRadius: radii.squircle,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 14,
  },
  creatorTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeColField: {
    flex: 1,
  },
  creatorTimeInput: {
    borderWidth: 1,
    borderRadius: radii.squircle,
    paddingHorizontal: 12,
    height: 38,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  swatchesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
  },
  swatchDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  swatchDotSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  swatchDotActive: {
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.12 }],
  },
  hexMiniInput: {
    width: 74,
    height: 26,
    borderWidth: 1,
    borderRadius: radii.xs,
    paddingHorizontal: 6,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  alertRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  alertChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  alertChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  updateExistingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  updateExistingLabel: {
    flex: 1,
    fontSize: 12,
  },
  createTplSubmit: {
    height: 38,
    borderRadius: radii.squircle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createTplSubmitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayPaintCard: {
    width: '23.4%',
    minWidth: 74,
    flexGrow: 1,
    padding: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
    minHeight: 72,
    justifyContent: 'center',
  },
  dayPaintLetter: {
    fontSize: 11,
    fontWeight: '700',
  },
  paintedPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
    maxWidth: '100%',
  },
  paintedPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  paintedHours: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  emptyDayLabel: {
    fontSize: 11,
  },
  bulkActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  bulkBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  bulkBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  bulkBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  clearBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBanner: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 8,
  },
  cyclePreviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  cycleBadge: {
    minWidth: 32,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: radii.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cycleHint: {
    fontSize: 11,
    lineHeight: 15,
  },
  rotationMetaRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  rotationDateCol: {
    flex: 1,
    minWidth: 135,
  },
  rotationHorizonCol: {
    flex: 1.5,
    minWidth: 200,
  },
  horizonRow: {
    flexDirection: 'row',
    gap: 5,
  },
  horizonChip: {
    flex: 1,
    height: 40,
    borderRadius: radii.squircle,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  horizonChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  customRangeBox: {
    flexDirection: 'row',
    gap: 10,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  customRangeField: {
    flex: 1.4,
  },
  customDaysField: {
    flex: 1,
  },
  slotCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 8,
  },
  slotHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  slotBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  slotHoursPreview: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  slotInputsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  slotTitleInput: {
    flex: 2,
    borderWidth: 1,
    borderRadius: radii.squircle,
    paddingHorizontal: 10,
    height: 36,
    fontSize: 13,
    fontWeight: '600',
  },
  slotTimeInput: {
    width: 66,
    borderWidth: 1,
    borderRadius: radii.squircle,
    paddingHorizontal: 6,
    height: 36,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  restExplainText: {
    fontSize: 12,
    lineHeight: 16,
  },
  summaryFooterText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  restWindowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  restIconBox: {
    width: 34,
    height: 34,
    borderRadius: radii.squircle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restWindowTextCol: {
    flex: 1,
    gap: 2,
  },
  restWindowRange: {
    fontSize: 14,
    fontWeight: '700',
  },
  restWindowMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ShiftPainterSheet;
