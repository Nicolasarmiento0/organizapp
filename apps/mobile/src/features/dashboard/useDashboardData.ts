import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  NotePageRecord,
  TaskRecord,
  WorkBlockRecord,
} from '@organiza/shared/schema';
import {
  getTodayDateKey,
  localStore,
  subscribeDatabaseChanges,
} from '../../db/client';
import { useTodayCockpit } from '../today';
import {
  computeHabitBadges,
  useHabitsManager,
  type BadgesSummary,
  type EnrichedHabitItem,
  type HabitBadgeProgress,
} from '../habits';
import { sanitizeLegacyNotePagesInStore } from '../notes';

export interface CalendarMonthRef {
  year: number;
  month: number; // 0-indexed (0 = enero, 11 = diciembre)
}

export interface DashboardTelemetry {
  habitPercent: number;
  completedHabits: number;
  totalHabits: number;
  tasksCompleted: number;
  tasksTotal: number;
  pendingTasks: number;
  pendingRemindersWithAlert: number;
  scheduledHours: string;
  scheduledMinutes: number;
  unlockedBadges: number;
  totalBadges: number;
  nextBadge: HabitBadgeProgress | null;
}

function parseTimeToMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(':');
  const hours = Number(hStr);
  const mins = Number(mStr);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return 0;
  return hours * 60 + mins;
}

function formatDurationMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0h 00m';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function computeActiveDaysInMonth(
  year: number,
  month: number,
  allTasks: TaskRecord[],
  todayKey: string,
  hasTodayBlocks: boolean
): Set<string> {
  const result = new Set<string>();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`;

  for (const task of allTasks) {
    if (task.dueDate && task.dueDate.startsWith(monthPrefix)) {
      result.add(task.dueDate);
    }
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${monthPrefix}${String(day).padStart(2, '0')}`;
    const logs = localStore.getHabitLogsForDate(key);
    if (logs.some((log) => log.isCompleted || log.status === 'completed')) {
      result.add(key);
    }
  }

  if (hasTodayBlocks && todayKey.startsWith(monthPrefix)) {
    result.add(todayKey);
  }

  return result;
}

export function useDashboardData(userId = '') {
  const todayKey = getTodayDateKey();
  const now = new Date();

  const { tasks, metrics, toggleTask } = useTodayCockpit(userId);
  const {
    habits,
    rawHabits,
    allLogs,
    toggleBinaryHabit,
    adjustQuantitativeHabit,
  } = useHabitsManager(userId);

  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const [calendarMonth, setCalendarMonth] = useState<CalendarMonthRef>({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [blocksForSelectedDate, setBlocksForSelectedDate] = useState<
    WorkBlockRecord[]
  >(() => localStore.getWorkBlocksForDate(todayKey));
  const [allWorkBlocks, setAllWorkBlocks] = useState<WorkBlockRecord[]>(() =>
    localStore.getAllWorkBlocks()
  );
  const [notes, setNotes] = useState<NotePageRecord[]>(() =>
    localStore.getNotePages()
  );

  const refreshDashboardCollections = useCallback(() => {
    setBlocksForSelectedDate(localStore.getWorkBlocksForDate(selectedDateKey));
    setAllWorkBlocks(localStore.getAllWorkBlocks());
    setNotes(localStore.getNotePages());
  }, [selectedDateKey]);

  useEffect(() => {
    refreshDashboardCollections();
    return subscribeDatabaseChanges(refreshDashboardCollections);
  }, [refreshDashboardCollections]);

  useEffect(() => {
    sanitizeLegacyNotePagesInStore();
  }, [notes]);

  const handleSelectDateKey = useCallback((nextKey: string) => {
    setSelectedDateKey(nextKey);
    const [yStr, mStr] = nextKey.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
      setCalendarMonth({ year: y, month: m - 1 });
    }
  }, []);

  const goToPrevMonth = useCallback(() => {
    setCalendarMonth((prev) =>
      prev.month === 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: prev.month - 1 }
    );
  }, []);

  const goToNextMonth = useCallback(() => {
    setCalendarMonth((prev) =>
      prev.month === 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: prev.month + 1 }
    );
  }, []);

  const goToToday = useCallback(() => {
    const d = new Date();
    const key = getTodayDateKey(d);
    setSelectedDateKey(key);
    setCalendarMonth({ year: d.getFullYear(), month: d.getMonth() });
  }, []);

  const activeDaysInMonth = useMemo(
    () =>
      computeActiveDaysInMonth(
        calendarMonth.year,
        calendarMonth.month,
        tasks,
        todayKey,
        blocksForSelectedDate.length > 0
      ),
    [
      calendarMonth.year,
      calendarMonth.month,
      tasks,
      todayKey,
      blocksForSelectedDate.length,
    ]
  );

  const badgesSummary = useMemo<BadgesSummary>(
    () => computeHabitBadges(rawHabits, allLogs, todayKey),
    [rawHabits, allLogs, todayKey]
  );

  const todayHabits = useMemo<EnrichedHabitItem[]>(() => {
    const scheduled = habits.filter(
      (h) => h.isScheduledOnActiveDate && !h.isPausedOnActiveDate
    );
    return scheduled.length > 0 ? scheduled : habits;
  }, [habits]);

  const telemetry = useMemo<DashboardTelemetry>(() => {
    const scheduledToday = habits.filter(
      (h) => h.isScheduledOnActiveDate && !h.isPausedOnActiveDate
    );
    const totalHabits = scheduledToday.length;
    const completedHabits = scheduledToday.filter(
      (h) => h.completedOnActiveDate
    ).length;
    const habitPercent =
      totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0;

    const pendingRemindersWithAlert = tasks.filter(
      (t) => !t.isCompleted && Boolean(t.reminderAt)
    ).length;

    const scheduledMinutes = blocksForSelectedDate.reduce((sum, block) => {
      const diff =
        parseTimeToMinutes(block.endTime) - parseTimeToMinutes(block.startTime);
      return sum + (diff > 0 ? diff : 0);
    }, 0);

    return {
      habitPercent,
      completedHabits,
      totalHabits,
      tasksCompleted: metrics.completedTasks,
      tasksTotal: metrics.totalTasks,
      pendingTasks: metrics.pendingTasks,
      pendingRemindersWithAlert,
      scheduledHours: formatDurationMinutes(scheduledMinutes),
      scheduledMinutes,
      unlockedBadges: badgesSummary.unlockedCount,
      totalBadges: badgesSummary.totalCount,
      nextBadge: badgesSummary.nextBadge,
    };
  }, [badgesSummary, blocksForSelectedDate, habits, metrics, tasks]);

  const handleQuickHabitTap = useCallback(
    (habitId: string) => {
      const target = habits.find((h) => h.id === habitId);
      if (!target) return;
      if (target.habitType === 'quantitative') {
        adjustQuantitativeHabit(habitId, 1, todayKey);
      } else {
        toggleBinaryHabit(habitId, todayKey);
      }
    },
    [habits, adjustQuantitativeHabit, toggleBinaryHabit, todayKey]
  );

  return {
    todayKey,
    selectedDateKey,
    setSelectedDateKey: handleSelectDateKey,
    calendarMonth,
    goToPrevMonth,
    goToNextMonth,
    goToToday,
    activeDaysInMonth,
    blocksForSelectedDate,
    allWorkBlocks,
    tasks,
    habits: todayHabits,
    allEnrichedHabits: habits,
    badgesSummary,
    notes,
    telemetry,
    handleQuickHabitTap,
    toggleBinaryHabitForDate: toggleBinaryHabit,
    toggleTask,
  };
}
