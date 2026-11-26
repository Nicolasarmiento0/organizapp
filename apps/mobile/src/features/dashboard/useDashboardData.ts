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
import { useTodayCockpit, type HabitWithDailyStatus } from '../today';

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
  totalStreakDays: number;
  rewardPoints: number;
  nextRewardTarget: number;
  nextRewardTitle: string;
  rewardProgressPercent: number;
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

function resolveRewardTitle(target: number): string {
  if (target <= 250) return 'Café de especialidad + pausa';
  if (target <= 500) return 'Cena especial / Tiempo libre';
  if (target <= 750) return 'Tarde de cine o gaming';
  return 'Upgrade de setup o escapada';
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
    if (logs.some((log) => log.isCompleted)) {
      result.add(key);
    }
  }

  if (hasTodayBlocks && todayKey.startsWith(monthPrefix)) {
    result.add(todayKey);
  }

  return result;
}

export function useDashboardData(userId = 'local-user') {
  const todayKey = getTodayDateKey();
  const now = new Date();

  const {
    tasks,
    habits,
    metrics,
    toggleTask,
    toggleHabitForToday,
  } = useTodayCockpit(userId);

  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const [calendarMonth, setCalendarMonth] = useState<CalendarMonthRef>({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [blocksForSelectedDate, setBlocksForSelectedDate] = useState<
    WorkBlockRecord[]
  >(() => localStore.getWorkBlocksForDate(todayKey));
  const [notes, setNotes] = useState<NotePageRecord[]>(() =>
    localStore.getNotePages()
  );

  const refreshDashboardCollections = useCallback(() => {
    setBlocksForSelectedDate(localStore.getWorkBlocksForDate(selectedDateKey));
    setNotes(localStore.getNotePages());
  }, [selectedDateKey]);

  useEffect(() => {
    refreshDashboardCollections();
    return subscribeDatabaseChanges(refreshDashboardCollections);
  }, [refreshDashboardCollections]);

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

  const telemetry = useMemo<DashboardTelemetry>(() => {
    const habitPercent =
      metrics.totalHabits > 0
        ? Math.round((metrics.completedHabits / metrics.totalHabits) * 100)
        : 0;

    const pendingRemindersWithAlert = tasks.filter(
      (t) => !t.isCompleted && Boolean(t.reminderAt)
    ).length;

    const scheduledMinutes = blocksForSelectedDate.reduce((sum, block) => {
      const diff =
        parseTimeToMinutes(block.endTime) - parseTimeToMinutes(block.startTime);
      return sum + (diff > 0 ? diff : 0);
    }, 0);

    const totalStreakDays = habits.reduce((sum, h) => sum + h.streak, 0);
    const rewardPoints = totalStreakDays * 10 + metrics.completedHabits * 25;
    const nextRewardTarget = Math.max(
      250,
      Math.ceil((rewardPoints + 1) / 250) * 250
    );
    const rewardProgressPercent = Math.min(
      100,
      Math.round((rewardPoints / nextRewardTarget) * 100)
    );

    return {
      habitPercent,
      completedHabits: metrics.completedHabits,
      totalHabits: metrics.totalHabits,
      tasksCompleted: metrics.completedTasks,
      tasksTotal: metrics.totalTasks,
      pendingTasks: metrics.pendingTasks,
      pendingRemindersWithAlert,
      scheduledHours: formatDurationMinutes(scheduledMinutes),
      scheduledMinutes,
      totalStreakDays,
      rewardPoints,
      nextRewardTarget,
      nextRewardTitle: resolveRewardTitle(nextRewardTarget),
      rewardProgressPercent,
    };
  }, [blocksForSelectedDate, habits, metrics, tasks]);

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
    tasks,
    habits: habits as HabitWithDailyStatus[],
    notes,
    telemetry,
    toggleHabitForToday,
    toggleTask,
  };
}
