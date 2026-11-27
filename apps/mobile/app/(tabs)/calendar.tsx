import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TaskRecord, WorkBlockRecord } from '@organiza/shared/schema';
import { AlarmSleep, Calendar } from '../../src/components/icons';
import { LiquidGlassCard } from '../../src/components/glass/LiquidGlassCard';
import {
  ALERT_OPTIONS,
  CALENDAR_COLORS,
  CalendarEventModal,
  CalendarHeaderStrip,
  ShiftPainterSheet,
  TimelineCanvas,
  UnscheduledTraySheet,
  minutesToTime,
  snapMinutes,
  useCalendarSchedule,
  type ExternalDragPreview,
  type TimelineCanvasHandle,
} from '../../src/features/calendar';
import { SnoozeMenuModal, type SnoozePreset } from '../../src/features/reminders';
import { getTodayDateKey } from '../../src/db/client';
import { authClient, resolveActiveUserId } from '../../src/services/authClient';
import { iconMetrics, radii, shadows, spacing } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';

interface DragGhostState {
  task: TaskRecord;
  x: number;
  y: number;
  dropMinutes: number | null;
}

export default function CalendarScheduleScreen() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width >= 860;

  const { data: session } = authClient.useSession();
  const activeUserId = resolveActiveUserId(session?.user?.id);
  const todayKey = getTodayDateKey();

  const {
    nowMinutes,
    selectedDateKey,
    setSelectedDateKey,
    blocks,
    allDayBlocks,
    timedBlocks,
    timedReminders,
    overdueReminders,
    anchoredHabits,
    unscheduledTasks,
    liveNextUp,
    shiftTemplates,
    upcomingRestPeriods,
    getDayActivityDots,
    getShiftBlockForDate,
    addWorkBlock,
    updateWorkBlock,
    removeWorkBlock,
    toggleReminderComplete,
    rescheduleReminderToSlot,
    scheduleUnscheduledTaskToSlot,
    bringOverdueReminderToNow,
    snoozeReminder,
    toggleCalendarHabit,
    seedDefaultShiftTemplatesIfEmpty,
    createShiftTemplate,
    updateShiftTemplate,
    deleteShiftTemplate,
    paintShiftOnDate,
    paintShiftOnWeekdays,
    applyRotation6x4Schedule,
    clearFutureShifts,
  } = useCalendarSchedule(todayKey, activeUserId);

  const timelineRef = useRef<TimelineCanvasHandle>(null);

  const [isMonthExpanded, setIsMonthExpanded] = useState(false);
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const [isShiftPainterOpen, setIsShiftPainterOpen] = useState(false);

  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [editingBlock, setEditingBlock] = useState<WorkBlockRecord | null>(null);
  const [modalInitialStart, setModalInitialStart] = useState('10:00');
  const [modalInitialEnd, setModalInitialEnd] = useState('11:00');

  const [snoozeTargetTask, setSnoozeTargetTask] = useState<TaskRecord | null>(
    null
  );
  const [dragGhost, setDragGhost] = useState<DragGhostState | null>(null);

  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setFeedbackToast(message);
    toastTimerRef.current = setTimeout(() => {
      setFeedbackToast(null);
      toastTimerRef.current = null;
    }, 2600);
  }, []);

  const handleToggleMonth = useCallback((next?: boolean) => {
    setIsMonthExpanded((prev) => (typeof next === 'boolean' ? next : !prev));
  }, []);

  const openCreateModalAt = useCallback((startMinutes: number) => {
    const startClock = minutesToTime(startMinutes);
    const endClock = minutesToTime(Math.min(23 * 60 + 55, startMinutes + 60));
    setEditingBlock(null);
    setModalInitialStart(startClock);
    setModalInitialEnd(endClock);
    setEventModalVisible(true);
  }, []);

  const handleOpenNewEvent = useCallback(() => {
    const defaultStart =
      selectedDateKey === todayKey
        ? Math.min(22 * 60, snapMinutes(nowMinutes + 15, 15))
        : 9 * 60;
    openCreateModalAt(defaultStart);
  }, [nowMinutes, openCreateModalAt, selectedDateKey, todayKey]);

  const handleOpenEditBlock = useCallback((block: WorkBlockRecord) => {
    setEditingBlock(block);
    setEventModalVisible(true);
  }, []);

  const handleSaveEvent = useCallback(
    (payload: {
      id?: string;
      title: string;
      blockType: WorkBlockRecord['blockType'];
      startTime: string;
      endTime: string;
      isAllDay: boolean;
      alertMinutesBefore: 0 | 15 | 60 | null;
      color: string | null;
      locationOrLink: string;
    }) => {
      if (payload.id) {
        updateWorkBlock(payload.id, {
          title: payload.title,
          blockType: payload.blockType,
          startTime: payload.startTime,
          endTime: payload.endTime,
          isAllDay: payload.isAllDay,
          alertMinutesBefore: payload.alertMinutesBefore,
          color: payload.color,
          locationOrLink: payload.locationOrLink,
        });
        showToast('Bloque actualizado');
      } else {
        addWorkBlock({
          title: payload.title,
          blockType: payload.blockType,
          dateKey: selectedDateKey,
          startTime: payload.startTime,
          endTime: payload.endTime,
          isAllDay: payload.isAllDay,
          alertMinutesBefore: payload.alertMinutesBefore,
          color: payload.color,
          locationOrLink: payload.locationOrLink,
        });
        const alertMeta = ALERT_OPTIONS.find(
          (a) => a.value === payload.alertMinutesBefore
        );
        if (!payload.isAllDay && payload.alertMinutesBefore !== null && alertMeta) {
          showToast(`Agendado · Alerta ${alertMeta.shortLabel.toLowerCase()}`);
        } else {
          showToast('Bloque agendado');
        }
      }
    },
    [addWorkBlock, selectedDateKey, showToast, updateWorkBlock]
  );

  const handleMoveBlock = useCallback(
    (blockId: string, newStartTime: string, newEndTime: string) => {
      updateWorkBlock(blockId, {
        startTime: newStartTime,
        endTime: newEndTime,
      });
      showToast(`Movido a ${newStartTime} – ${newEndTime}`);
    },
    [showToast, updateWorkBlock]
  );

  const handleResizeBlock = useCallback(
    (blockId: string, newEndTime: string) => {
      updateWorkBlock(blockId, { endTime: newEndTime });
      showToast(`Duración actualizada hasta ${newEndTime}`);
    },
    [showToast, updateWorkBlock]
  );

  const handleMoveReminder = useCallback(
    (taskId: string, newStartMinutes: number) => {
      rescheduleReminderToSlot(taskId, selectedDateKey, newStartMinutes);
      showToast(`Recordatorio movido a ${minutesToTime(newStartMinutes)}`);
    },
    [rescheduleReminderToSlot, selectedDateKey, showToast]
  );

  const handleBringOverdueToNow = useCallback(
    (taskId: string) => {
      bringOverdueReminderToNow(taskId);
      showToast('Recordatorio movido al bloque actual');
    },
    [bringOverdueReminderToNow, showToast]
  );

  const handleSelectSnooze = useCallback(
    (taskId: string, preset: SnoozePreset) => {
      const result = snoozeReminder(taskId, preset);
      if (result) {
        showToast(`Pospuesto para ${result.displayLabel}`);
      }
    },
    [showToast, snoozeReminder]
  );

  const handleQuickScheduleUnscheduled = useCallback(
    (task: TaskRecord, startMinutes: number) => {
      scheduleUnscheduledTaskToSlot(task.id, selectedDateKey, startMinutes, 60);
      timelineRef.current?.scrollToMinutes(startMinutes);
      showToast(`Programado a las ${minutesToTime(startMinutes)}`);
    },
    [scheduleUnscheduledTaskToSlot, selectedDateKey, showToast]
  );

  // Drag & drop desde la bandeja "Sin Programar" hacia la línea de tiempo
  const handleTrayDragStart = useCallback(
    (task: TaskRecord, absX: number, absY: number) => {
      const dropMinutes =
        timelineRef.current?.resolveDropMinute(absX, absY) ?? null;
      setDragGhost({ task, x: absX, y: absY, dropMinutes });
    },
    []
  );

  const handleTrayDragMove = useCallback((absX: number, absY: number) => {
    const dropMinutes =
      timelineRef.current?.resolveDropMinute(absX, absY) ?? null;
    setDragGhost((prev) =>
      prev ? { ...prev, x: absX, y: absY, dropMinutes } : null
    );
  }, []);

  const handleTrayDragEnd = useCallback(
    (task: TaskRecord, absX: number, absY: number) => {
      const dropMinutes =
        timelineRef.current?.resolveDropMinute(absX, absY) ?? null;
      setDragGhost(null);
      if (dropMinutes !== null) {
        scheduleUnscheduledTaskToSlot(task.id, selectedDateKey, dropMinutes, 60);
        showToast(`Programado a las ${minutesToTime(dropMinutes)}`);
      }
    },
    [scheduleUnscheduledTaskToSlot, selectedDateKey, showToast]
  );

  const externalDropPreview = useMemo<ExternalDragPreview | null>(() => {
    if (!dragGhost || dragGhost.dropMinutes === null) return null;
    return {
      title: dragGhost.task.title,
      startMinutes: dragGhost.dropMinutes,
      durationMinutes: 60,
    };
  }, [dragGhost]);

  const dockClearance = isDesktop
    ? 20
    : Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 12) + 74;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.canvas }]}
      edges={['top']}
    >
      <View style={styles.stageContainer}>
        <CalendarHeaderStrip
          selectedDateKey={selectedDateKey}
          todayKey={todayKey}
          isMonthExpanded={isMonthExpanded}
          onToggleMonthExpanded={handleToggleMonth}
          onSelectDate={(key) => {
            setSelectedDateKey(key);
          }}
          getDayActivityDots={getDayActivityDots}
          unscheduledCount={unscheduledTasks.length}
          isTrayOpen={isTrayOpen}
          onToggleTray={() => setIsTrayOpen((prev) => !prev)}
          onOpenShiftPainter={() => setIsShiftPainterOpen(true)}
          onOpenNewEvent={handleOpenNewEvent}
        />

        <TimelineCanvas
          ref={timelineRef}
          selectedDateKey={selectedDateKey}
          todayKey={todayKey}
          nowMinutes={nowMinutes}
          liveNextUp={liveNextUp}
          allDayBlocks={allDayBlocks}
          timedBlocks={timedBlocks}
          timedReminders={timedReminders}
          overdueReminders={overdueReminders}
          anchoredHabits={anchoredHabits}
          externalDropPreview={externalDropPreview}
          bottomContentPadding={
            dockClearance + (isTrayOpen ? 164 : 24)
          }
          onPressBlock={handleOpenEditBlock}
          onMoveBlock={handleMoveBlock}
          onResizeBlock={handleResizeBlock}
          onLongPressEmptySlot={openCreateModalAt}
          onToggleReminderComplete={toggleReminderComplete}
          onMoveReminder={handleMoveReminder}
          onBringOverdueToNow={handleBringOverdueToNow}
          onOpenSnooze={(task) => setSnoozeTargetTask(task)}
          onToggleHabit={(habitId) => toggleCalendarHabit(habitId, selectedDateKey)}
        />
      </View>

      {/* Bandeja Desplegable de "Sin Programar" */}
      <UnscheduledTraySheet
        visible={isTrayOpen}
        tasks={unscheduledTasks}
        blocksOnDate={blocks}
        nowMinutes={nowMinutes}
        bottomOffset={dockClearance}
        onClose={() => setIsTrayOpen(false)}
        onQuickScheduleTask={handleQuickScheduleUnscheduled}
        onDragStart={handleTrayDragStart}
        onDragMove={handleTrayDragMove}
        onDragEnd={handleTrayDragEnd}
      />

      {/* Ghost flotante al arrastrar desde Sin Programar */}
      {dragGhost ? (
        <View
          pointerEvents="none"
          style={[
            styles.ghostPill,
            {
              left: Math.max(12, dragGhost.x - 95),
              top: Math.max(12, dragGhost.y - 42),
              backgroundColor: theme.cardElevated,
              borderColor: CALENDAR_COLORS.coral,
            },
          ]}
        >
          <Calendar
            size={14}
            color={CALENDAR_COLORS.coral}
            strokeWidth={2}
          />
          <View style={styles.ghostTextCol}>
            <Text
              style={[styles.ghostTitle, { color: theme.textPrimary }]}
              numberOfLines={1}
            >
              {dragGhost.task.title}
            </Text>
            <Text
              style={[styles.ghostSub, { color: CALENDAR_COLORS.coral }]}
            >
              {dragGhost.dropMinutes !== null
                ? `Soltar a las ${minutesToTime(dragGhost.dropMinutes)}`
                : 'Arrastra sobre la línea de tiempo'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Modal de Creación / Edición Rápida de Eventos y Bloques */}
      <CalendarEventModal
        visible={eventModalVisible}
        dateKey={selectedDateKey}
        editingBlock={editingBlock}
        initialStartTime={modalInitialStart}
        initialEndTime={modalInitialEnd}
        onClose={() => setEventModalVisible(false)}
        onSave={handleSaveEvent}
        onDelete={(blockId) => {
          removeWorkBlock(blockId);
          showToast('Bloque eliminado');
        }}
      />

      {/* Pintor de Turnos de Trabajo (1-Tap Shift Painter & Bloque 6x4) */}
      <ShiftPainterSheet
        visible={isShiftPainterOpen}
        selectedDateKey={selectedDateKey}
        todayKey={todayKey}
        templates={shiftTemplates}
        upcomingRestPeriods={upcomingRestPeriods}
        getShiftBlockForDate={getShiftBlockForDate}
        onSeedDefaults={seedDefaultShiftTemplatesIfEmpty}
        onCreateTemplate={createShiftTemplate}
        onUpdateTemplate={updateShiftTemplate}
        onDeleteTemplate={deleteShiftTemplate}
        onPaintDay={paintShiftOnDate}
        onPaintWeekdays={paintShiftOnWeekdays}
        onApplyRotation6x4={(config) => {
          const res = applyRotation6x4Schedule(config);
          showToast(
            `Bloque 6×4 agregado · ${res.createdShifts} turnos · ${res.createdRestDays} días libres`
          );
          return res;
        }}
        onClearFutureShifts={(startKey, horizon) => {
          const cleared = clearFutureShifts(startKey, horizon);
          showToast(
            cleared > 0
              ? `Se limpiaron ${cleared} registros`
              : 'No había turnos por limpiar'
          );
          return cleared;
        }}
        onJumpToDate={(dateKey) => setSelectedDateKey(dateKey)}
        onClose={() => setIsShiftPainterOpen(false)}
      />

      {/* Modal Posponer Recordatorio */}
      <SnoozeMenuModal
        visible={Boolean(snoozeTargetTask)}
        task={snoozeTargetTask}
        onClose={() => setSnoozeTargetTask(null)}
        onSelectPreset={handleSelectSnooze}
      />

      {/* Toast flotante de confirmación */}
      {feedbackToast ? (
        <View
          pointerEvents="none"
          style={[styles.toastWrapper, { bottom: dockClearance + 12 }]}
        >
          <LiquidGlassCard
            variant="floating"
            intensity={85}
            noPadding
            style={[
              styles.toastPill,
              { borderColor: CALENDAR_COLORS.coralBorder },
            ]}
            contentStyle={styles.toastContent}
          >
            <AlarmSleep
              size={14}
              color={CALENDAR_COLORS.coral}
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
  stageContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  ghostPill: {
    position: 'absolute',
    width: 196,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 120,
    ...shadows.floatingDock,
  },
  ghostTextCol: {
    flex: 1,
    gap: 1,
  },
  ghostTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  ghostSub: {
    fontSize: 10,
    fontWeight: '700',
  },
  toastWrapper: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    zIndex: 90,
  },
  toastPill: {
    borderRadius: radii.pill,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
