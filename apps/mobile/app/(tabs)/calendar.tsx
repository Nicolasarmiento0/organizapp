import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { TaskRecord, WorkBlockType } from '@organiza/shared/schema';
import {
  AlarmSleep,
  Bell,
  Briefcase,
  Calendar,
  Check,
  Circle,
  Flag,
  MapPin,
  Plus,
  Trash2,
  Zap,
} from '../../src/components/icons';
import {
  iconMetrics,
  radii,
  shadows,
  spacing,
  typography,
} from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { LiquidGlassCard } from '../../src/components/glass/LiquidGlassCard';
import { MacIconBadge } from '../../src/components/glass/MacIconBadge';
import { useCalendarSchedule } from '../../src/features/calendar';
import {
  SnoozeMenuModal,
  isTaskOverdue,
  type SnoozePreset,
} from '../../src/features/reminders';
import { WeekDayLensPill } from '../../src/features/dashboard/CalendarDayCell';
import { getTodayDateKey } from '../../src/db/client';
import { authClient, resolveActiveUserId } from '../../src/services/authClient';

function buildWeekDays() {
  const base = new Date();
  const days: Array<{ dateKey: string; dayShort: string; dayNum: string }> = [];
  const shortNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  for (let offset = -1; offset <= 5; offset++) {
    const d = new Date(base);
    d.setDate(base.getDate() + offset);
    days.push({
      dateKey: getTodayDateKey(d),
      dayShort: shortNames[d.getDay()] ?? 'Día',
      dayNum: String(d.getDate()).padStart(2, '0'),
    });
  }
  return days;
}

export default function CalendarScheduleScreen() {
  const { theme } = useTheme();
  const { data: session } = authClient.useSession();
  const activeUserId = resolveActiveUserId(session?.user?.id);

  const todayKey = getTodayDateKey();
  const {
    selectedDateKey,
    setSelectedDateKey,
    blocks,
    timedReminders,
    timelineItems,
    reminderDateKeys,
    addWorkBlock,
    removeWorkBlock,
    toggleReminderComplete,
    snoozeReminder,
  } = useCalendarSchedule(todayKey, activeUserId);

  const weekDays = useMemo(() => buildWeekDays(), []);
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('10:00');
  const [newEnd, setNewEnd] = useState('12:00');
  const [selectedType, setSelectedType] = useState<WorkBlockType>('deep_work');
  const [snoozeTargetTask, setSnoozeTargetTask] = useState<TaskRecord | null>(
    null
  );
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = (message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setFeedbackToast(message);
    toastTimerRef.current = setTimeout(() => {
      setFeedbackToast(null);
      toastTimerRef.current = null;
    }, 2600);
  };

  const handleSelectSnooze = (taskId: string, preset: SnoozePreset) => {
    const result = snoozeReminder(taskId, preset);
    if (result) {
      showToast(`Pospuesto para ${result.displayLabel}`);
    }
  };

  const calendarPalette = theme.modules.calendar;
  const nowMs = Date.now();

  const handleAddBlock = () => {
    const clean = newTitle.trim();
    if (!clean) return;
    addWorkBlock({
      title: clean,
      blockType: selectedType,
      startTime: newStart.trim() || '09:00',
      endTime: newEnd.trim() || '11:00',
      locationOrLink:
        selectedType === 'deep_work'
          ? 'Bloque de concentración profunda'
          : 'Horario laboral programado',
      isRecurring: false,
    });
    setNewTitle('');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.canvas }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cabecera Fase 2: Calendario & Horarios */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <MacIconBadge
              icon={Calendar}
              module="calendar"
              containerSize={40}
              size={20}
            />
            <View>
              <Text style={[styles.phaseTag, { color: calendarPalette.icon }]}>
                FASE 2 • ESTILO macOS & TIME-BLOCKING
              </Text>
              <Text style={[styles.screenTitle, { color: theme.textPrimary }]}>
                Calendario & Horarios
              </Text>
            </View>
          </View>
        </View>

        {/* Selector Horizontal de Semana */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weekStrip}
        >
          {weekDays.map((day) => {
            const isSelected = day.dateKey === selectedDateKey;
            return (
              <WeekDayLensPill
                key={day.dateKey}
                dateKey={day.dateKey}
                dayShort={day.dayShort}
                dayNum={day.dayNum}
                isSelected={isSelected}
                hasActivity={reminderDateKeys.has(day.dateKey)}
                onSelect={setSelectedDateKey}
                borderRadius={radii.md}
              />
            );
          })}
        </ScrollView>

        {/* Creador Rápido de Bloque Horario */}
        <LiquidGlassCard style={styles.creatorCard} contentStyle={styles.creatorContent}>
          <Text style={[styles.cardSectionTitle, { color: theme.textSecondary }]}>
            Nuevo Bloque de Horario / Trabajo
          </Text>

          <TextInput
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="Ej. Turno Mañana, Deep Work o Reunión..."
            placeholderTextColor={theme.textMuted}
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.glassBorder,
                color: theme.textPrimary,
              },
            ]}
          />

          <View style={styles.timeInputsRow}>
            <View style={styles.timeField}>
              <Text style={[styles.smallLabel, { color: theme.textSecondary }]}>Inicio</Text>
              <TextInput
                value={newStart}
                onChangeText={setNewStart}
                placeholder="09:00"
                placeholderTextColor={theme.textMuted}
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
            <View style={styles.timeField}>
              <Text style={[styles.smallLabel, { color: theme.textSecondary }]}>Fin</Text>
              <TextInput
                value={newEnd}
                onChangeText={setNewEnd}
                placeholder="11:00"
                placeholderTextColor={theme.textMuted}
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

          <View style={styles.typeSelectorRow}>
            {(
              [
                { key: 'deep_work', label: 'Deep Work' },
                { key: 'work_shift', label: 'Turno Trabajo' },
                { key: 'personal', label: 'Personal' },
              ] as const
            ).map((t) => {
              const active = selectedType === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setSelectedType(t.key)}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: active
                        ? calendarPalette.background
                        : theme.inputBg,
                      borderColor: active
                        ? calendarPalette.border
                        : theme.glassBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      {
                        color: active ? calendarPalette.icon : theme.textSecondary,
                      },
                      active && { fontWeight: '700' },
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}

            <Pressable
              onPress={handleAddBlock}
              style={[styles.addBlockButton, { backgroundColor: theme.accentCobalt }]}
            >
              <Plus size={16} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.addBlockButtonText}>Agendar</Text>
            </Pressable>
          </View>
        </LiquidGlassCard>

        {/* Línea de Tiempo del Día */}
        <View style={styles.timelineSection}>
          <Text style={[styles.timelineHeader, { color: theme.textPrimary }]}>
            Cronograma · {blocks.length}{' '}
            {blocks.length === 1 ? 'bloque' : 'bloques'} ·{' '}
            {timedReminders.length}{' '}
            {timedReminders.length === 1 ? 'recordatorio' : 'recordatorios'}
          </Text>

          {timelineItems.length === 0 ? (
            <LiquidGlassCard style={styles.emptyTimelineCard}>
              <Text style={[styles.emptyTimelineText, { color: theme.textSecondary }]}>
                Sin bloques ni recordatorios programados con hora para este día.
              </Text>
            </LiquidGlassCard>
          ) : (
            timelineItems.map((item) => {
              if (item.kind === 'reminder') {
                const { task } = item;
                const overdue = isTaskOverdue(task, nowMs, todayKey);
                const isUrgent = Boolean(task.isFlagged) || task.priority === 3;
                const ringColor =
                  isUrgent || overdue
                    ? theme.accentPrimaryLink
                    : theme.accentPrimary;

                return (
                  <LiquidGlassCard
                    key={`reminder-${task.id}`}
                    noPadding
                    style={[
                      styles.blockCard,
                      !task.isCompleted && {
                        borderColor: theme.accentPrimaryBorder,
                      },
                    ]}
                    contentStyle={[
                      styles.blockRow,
                      !task.isCompleted && {
                        backgroundColor: theme.accentPrimarySoft,
                      },
                    ]}
                  >
                    <View style={styles.timeColumn}>
                      <Text
                        style={[
                          styles.startTimeText,
                          {
                            color: task.isCompleted
                              ? theme.textMuted
                              : theme.accentPrimaryLink,
                          },
                        ]}
                      >
                        {item.sortTime}
                      </Text>
                      <Text
                        style={[
                          styles.endTimeText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Aviso
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => toggleReminderComplete(task.id)}
                      hitSlop={10}
                      style={styles.reminderRingHit}
                    >
                      {task.isCompleted ? (
                        <View
                          style={[
                            styles.reminderCheckedCircle,
                            { backgroundColor: theme.accentPrimary },
                          ]}
                        >
                          <Check
                            size={14}
                            color={theme.accentPrimaryText}
                            strokeWidth={2.5}
                          />
                        </View>
                      ) : (
                        <Circle
                          size={22}
                          color={ringColor}
                          strokeWidth={2.1}
                        />
                      )}
                    </Pressable>

                    <View style={styles.blockMainInfo}>
                      <View style={styles.blockTypeBadgeRow}>
                        <Bell
                          size={12}
                          color={
                            task.isCompleted
                              ? theme.textMuted
                              : theme.accentPrimaryLink
                          }
                          strokeWidth={2}
                        />
                        <Text
                          style={[
                            styles.blockTypeLabel,
                            {
                              color: task.isCompleted
                                ? theme.textMuted
                                : theme.accentPrimaryLink,
                            },
                          ]}
                        >
                          RECORDATORIO
                        </Text>

                        {task.isFlagged ? (
                          <Flag
                            size={11}
                            color={theme.accentPrimaryLink}
                            strokeWidth={2}
                          />
                        ) : null}

                        {overdue && !task.isCompleted ? (
                          <View
                            style={[
                              styles.overdueTag,
                              {
                                backgroundColor: theme.accentPrimary,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.overdueTagText,
                                { color: theme.accentPrimaryText },
                              ]}
                            >
                              Vencido
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <Text
                        style={[
                          styles.blockTitle,
                          { color: theme.textPrimary },
                          task.isCompleted && {
                            textDecorationLine: 'line-through',
                            color: theme.textMuted,
                          },
                        ]}
                      >
                        {task.title}
                      </Text>

                      {task.notes ? (
                        <Text
                          style={[
                            styles.locationText,
                            { color: theme.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {task.notes}
                        </Text>
                      ) : null}
                    </View>

                    {!task.isCompleted ? (
                      <Pressable
                        onPress={() => setSnoozeTargetTask(task)}
                        hitSlop={8}
                        style={[
                          styles.snoozePillBtn,
                          {
                            backgroundColor: theme.card,
                            borderColor: theme.accentPrimaryBorder,
                          },
                        ]}
                      >
                        <AlarmSleep
                          size={15}
                          color={theme.accentPrimaryLink}
                          strokeWidth={iconMetrics.strokeWidth}
                        />
                      </Pressable>
                    ) : null}
                  </LiquidGlassCard>
                );
              }

              const { block } = item;
              const isDeepWork = block.blockType === 'deep_work';
              const badgePalette = isDeepWork
                ? theme.modules.calendar
                : theme.modules.dashboard;

              return (
                <LiquidGlassCard
                  key={`block-${block.id}`}
                  noPadding
                  style={styles.blockCard}
                  contentStyle={styles.blockRow}
                >
                  <View style={styles.timeColumn}>
                    <Text
                      style={[styles.startTimeText, { color: theme.textPrimary }]}
                    >
                      {block.startTime}
                    </Text>
                    <Text
                      style={[
                        styles.endTimeText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {block.endTime}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.verticalAccentBar,
                      { backgroundColor: badgePalette.icon },
                    ]}
                  />

                  <View style={styles.blockMainInfo}>
                    <View style={styles.blockTypeBadgeRow}>
                      {isDeepWork ? (
                        <Zap
                          size={12}
                          color={badgePalette.icon}
                          strokeWidth={2}
                        />
                      ) : (
                        <Briefcase
                          size={12}
                          color={badgePalette.icon}
                          strokeWidth={2}
                        />
                      )}
                      <Text
                        style={[
                          styles.blockTypeLabel,
                          { color: badgePalette.icon },
                        ]}
                      >
                        {block.blockType === 'deep_work'
                          ? 'DEEP WORK'
                          : block.blockType === 'work_shift'
                            ? 'TURNO LABORAL'
                            : 'PERSONAL'}
                      </Text>
                    </View>

                    <Text
                      style={[styles.blockTitle, { color: theme.textPrimary }]}
                    >
                      {block.title}
                    </Text>

                    {block.locationOrLink ? (
                      <View style={styles.locationRow}>
                        <MapPin
                          size={12}
                          color={theme.textSecondary}
                          strokeWidth={iconMetrics.strokeWidth}
                        />
                        <Text
                          style={[
                            styles.locationText,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {block.locationOrLink}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Pressable
                    onPress={() => removeWorkBlock(block.id)}
                    hitSlop={10}
                    style={styles.deleteBtn}
                  >
                    <Trash2
                      size={16}
                      color={theme.textMuted}
                      strokeWidth={iconMetrics.strokeWidth}
                    />
                  </Pressable>
                </LiquidGlassCard>
              );
            })
          )}
        </View>
      </ScrollView>

      <SnoozeMenuModal
        visible={Boolean(snoozeTargetTask)}
        task={snoozeTargetTask}
        onClose={() => setSnoozeTargetTask(null)}
        onSelectPreset={handleSelectSnooze}
      />

      {feedbackToast ? (
        <View pointerEvents="none" style={styles.toastWrapper}>
          <LiquidGlassCard
            variant="floating"
            intensity={85}
            noPadding
            style={[
              styles.toastPill,
              { borderColor: theme.accentPrimaryBorder },
            ]}
            contentStyle={styles.toastContent}
          >
            <AlarmSleep
              size={15}
              color={theme.accentPrimaryLink}
              strokeWidth={iconMetrics.strokeWidth}
            />
            <Text style={[styles.toastText, { color: theme.textPrimary }]}>
              {feedbackToast}
            </Text>
          </LiquidGlassCard>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 120,
    gap: spacing.lg,
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
  phaseTag: {
    fontSize: 10,
    ...typography.eyebrow,
  },
  screenTitle: {
    fontSize: 24,
    ...typography.screenTitle,
  },
  weekStrip: {
    gap: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 4,
    overflow: 'visible',
  },
  creatorCard: {
    borderRadius: radii.lg,
  },
  creatorContent: {
    gap: spacing.sm,
  },
  cardSectionTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    ...typography.eyebrow,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.squircle,
    paddingHorizontal: spacing.md,
    height: 42,
    fontSize: 14,
  },
  timeInputsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timeField: {
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
    height: 38,
    fontSize: 14,
    fontWeight: '600',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  addBlockButton: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  addBlockButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timelineSection: {
    gap: spacing.sm,
  },
  timelineHeader: {
    fontSize: 14,
    fontWeight: '700',
  },
  blockCard: {
    borderRadius: radii.md,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  timeColumn: {
    width: 48,
    alignItems: 'flex-end',
    gap: 2,
  },
  startTimeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  endTimeText: {
    fontSize: 12,
  },
  verticalAccentBar: {
    width: 3.5,
    height: '85%',
    borderRadius: radii.pill,
  },
  blockMainInfo: {
    flex: 1,
    gap: 3,
  },
  blockTypeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  blockTypeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
  },
  deleteBtn: {
    padding: 4,
  },
  emptyTimelineCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  emptyTimelineText: {
    fontSize: 13,
    textAlign: 'center',
    ...typography.body,
  },
  reminderRingHit: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
  },
  reminderCheckedCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overdueTag: {
    borderRadius: radii.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginLeft: 2,
  },
  overdueTagText: {
    fontSize: 9,
    ...typography.bodySemiBold,
  },
  snoozePillBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastWrapper: {
    position: 'absolute',
    bottom: 92,
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
  },
  toastPill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    ...shadows.floatingDock,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toastText: {
    fontSize: 13,
    ...typography.bodySemiBold,
  },
});
