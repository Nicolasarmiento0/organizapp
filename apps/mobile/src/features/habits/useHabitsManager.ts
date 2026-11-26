import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  HabitFrequency,
  HabitLogRecord,
  HabitLogStatus,
  HabitRecord,
  HabitRewardRecord,
  HabitTimeOfDay,
  HabitType,
} from '@organiza/shared/schema';
import {
  createLocalId,
  getTodayDateKey,
  localStore,
  notifyDatabaseChanged,
  subscribeDatabaseChanges,
} from '../../db/client';
import { triggerBackgroundSync } from '../../db/sync';
import {
  computeAvailableRestShields,
  computeHabitStreakStats,
  computeHabitWeeklyProgress,
  isHabitPausedOnDate,
  isHabitScheduledOnDate,
  parseScheduledDays,
  shiftDateKey,
  type HabitWeeklyProgress,
  type RestShieldStats,
} from './streakEngine';

export interface EnrichedHabitItem extends HabitRecord {
  scheduledDaysList: number[];
  isScheduledOnActiveDate: boolean;
  isPausedOnActiveDate: boolean;
  activeCount: number;
  activeStatus: HabitLogStatus | null;
  completedOnActiveDate: boolean;
  shieldedOnActiveDate: boolean;
  computedStreak: number;
  computedBestStreak: number;
  weeklyProgress: HabitWeeklyProgress;
}

export interface UpsertHabitInput {
  title: string;
  icon: string;
  habitType: HabitType;
  unit?: string | null;
  targetPerDay: number;
  weeklyGoal?: number | null;
  frequency: HabitFrequency;
  scheduledDays: number[];
  timeOfDay: HabitTimeOfDay;
  reminderTime?: string | null;
  isPaused?: boolean;
  pausedUntil?: string | null;
}

function deriveFrequencyFromDays(days: number[]): HabitFrequency {
  const sorted = Array.from(new Set(days)).sort((a, b) => a - b);
  if (sorted.length === 7) return 'daily';
  if (sorted.length === 5 && sorted.join(',') === '1,2,3,4,5') return 'weekdays';
  if (sorted.length === 2 && sorted.join(',') === '0,6') return 'weekends';
  return 'custom';
}

function recalculateAndPersistHabitStreak(
  habitId: string,
  referenceDateKey: string
): void {
  const habit = localStore.getHabitById(habitId);
  if (!habit) return;
  const allLogs = localStore.getAllHabitLogs().filter((l) => l.habitId === habitId);
  const { currentStreak, bestStreak } = computeHabitStreakStats(
    habit,
    allLogs,
    referenceDateKey
  );

  if (habit.streak !== currentStreak || habit.bestStreak !== bestStreak) {
    localStore.updateHabit(habitId, {
      streak: currentStreak,
      bestStreak,
      isDirty: true,
      updatedAt: Date.now(),
    });
  }
}

export function useHabitsManager(userId = 'local-user') {
  const todayKey = getTodayDateKey();
  const yesterdayKey = useMemo(() => shiftDateKey(todayKey, -1), [todayKey]);
  const [activeDateKey, setActiveDateKey] = useState<string>(todayKey);

  const [rawHabits, setRawHabits] = useState<HabitRecord[]>(() =>
    localStore.getHabits()
  );
  const [allLogs, setAllLogs] = useState<HabitLogRecord[]>(() =>
    localStore.getAllHabitLogs()
  );
  const [rewards, setRewards] = useState<HabitRewardRecord[]>(() =>
    localStore.getHabitRewards()
  );

  const refreshFromStore = useCallback(() => {
    setRawHabits(localStore.getHabits());
    setAllLogs(localStore.getAllHabitLogs());
    setRewards(localStore.getHabitRewards());
  }, []);

  useEffect(() => {
    return subscribeDatabaseChanges(refreshFromStore);
  }, [refreshFromStore]);

  const logsByHabitId = useMemo(() => {
    const map = new Map<string, HabitLogRecord[]>();
    for (const log of allLogs) {
      if (log.deletedAt) continue;
      const list = map.get(log.habitId);
      if (list) list.push(log);
      else map.set(log.habitId, [log]);
    }
    return map;
  }, [allLogs]);

  const habits = useMemo<EnrichedHabitItem[]>(() => {
    return rawHabits.map((habit) => {
      const habitLogsList = logsByHabitId.get(habit.id) ?? [];
      const activeLog = habitLogsList.find((l) => l.dateKey === activeDateKey);
      const scheduled = isHabitScheduledOnDate(habit, activeDateKey);
      const paused = isHabitPausedOnDate(habit, activeDateKey);
      const stats = computeHabitStreakStats(habit, habitLogsList, todayKey);
      const computedStreak = Math.max(habit.streak, stats.currentStreak);
      const computedBestStreak = Math.max(habit.bestStreak, stats.bestStreak, computedStreak);
      const weeklyProgress = computeHabitWeeklyProgress(habit, habitLogsList, todayKey);

      const activeStatus: HabitLogStatus | null = activeLog?.status ?? null;
      const completedOnActiveDate = Boolean(
        activeLog && (activeLog.status === 'completed' || activeLog.isCompleted)
      );
      const shieldedOnActiveDate = activeStatus === 'rest_shield';

      return {
        ...habit,
        scheduledDaysList: parseScheduledDays(habit.scheduledDays),
        isScheduledOnActiveDate: scheduled,
        isPausedOnActiveDate: paused,
        activeCount: activeLog ? activeLog.completedCount : 0,
        activeStatus,
        completedOnActiveDate,
        shieldedOnActiveDate,
        computedStreak,
        computedBestStreak,
        weeklyProgress,
      };
    });
  }, [rawHabits, logsByHabitId, activeDateKey, todayKey]);

  const shieldStats = useMemo<RestShieldStats>(
    () => computeAvailableRestShields(allLogs, todayKey),
    [allLogs, todayKey]
  );

  const yesterdayPendingCount = useMemo(() => {
    let pending = 0;
    for (const habit of rawHabits) {
      if (isHabitPausedOnDate(habit, yesterdayKey)) continue;
      if (!isHabitScheduledOnDate(habit, yesterdayKey)) continue;
      const habitLogsList = logsByHabitId.get(habit.id) ?? [];
      const yLog = habitLogsList.find((l) => l.dateKey === yesterdayKey);
      const done =
        yLog &&
        (yLog.status === 'completed' ||
          yLog.isCompleted ||
          yLog.status === 'rest_shield' ||
          yLog.status === 'paused');
      if (!done) pending += 1;
    }
    return pending;
  }, [rawHabits, logsByHabitId, yesterdayKey]);

  const createHabit = useCallback(
    (input: UpsertHabitInput): HabitRecord => {
      const now = Date.now();
      const days =
        input.scheduledDays.length > 0
          ? Array.from(new Set(input.scheduledDays)).sort((a, b) => a - b)
          : [0, 1, 2, 3, 4, 5, 6];
      const record: HabitRecord = {
        id: createLocalId(),
        userId,
        title: input.title.trim(),
        icon: input.icon || 'Sparkles',
        habitType: input.habitType,
        unit:
          input.habitType === 'quantitative'
            ? input.unit?.trim() || 'veces'
            : null,
        frequency: deriveFrequencyFromDays(days),
        scheduledDays: JSON.stringify(days),
        targetPerDay:
          input.habitType === 'quantitative'
            ? Math.max(1, Math.round(input.targetPerDay))
            : 1,
        weeklyGoal:
          input.weeklyGoal && input.weeklyGoal > 0
            ? Math.min(7, Math.round(input.weeklyGoal))
            : null,
        streak: 0,
        bestStreak: 0,
        isPaused: Boolean(input.isPaused),
        pausedUntil: input.isPaused ? input.pausedUntil ?? null : null,
        timeOfDay: input.timeOfDay ?? 'any',
        reminderTime: input.reminderTime?.trim() || null,
        isArchived: false,
        isDirty: true,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      localStore.upsertHabit(record);
      notifyDatabaseChanged();
      triggerBackgroundSync();
      return record;
    },
    [userId]
  );

  const updateHabit = useCallback(
    (habitId: string, input: UpsertHabitInput) => {
      const existing = localStore.getHabitById(habitId);
      if (!existing) return;

      const days =
        input.scheduledDays.length > 0
          ? Array.from(new Set(input.scheduledDays)).sort((a, b) => a - b)
          : [0, 1, 2, 3, 4, 5, 6];

      localStore.updateHabit(habitId, {
        title: input.title.trim() || existing.title,
        icon: input.icon || existing.icon,
        habitType: input.habitType,
        unit:
          input.habitType === 'quantitative'
            ? input.unit?.trim() || 'veces'
            : null,
        frequency: deriveFrequencyFromDays(days),
        scheduledDays: JSON.stringify(days),
        targetPerDay:
          input.habitType === 'quantitative'
            ? Math.max(1, Math.round(input.targetPerDay))
            : 1,
        weeklyGoal:
          input.weeklyGoal && input.weeklyGoal > 0
            ? Math.min(7, Math.round(input.weeklyGoal))
            : null,
        isPaused: Boolean(input.isPaused),
        pausedUntil: input.isPaused ? input.pausedUntil ?? null : null,
        timeOfDay: input.timeOfDay ?? 'any',
        reminderTime: input.reminderTime?.trim() || null,
        isDirty: true,
        updatedAt: Date.now(),
      });

      recalculateAndPersistHabitStreak(habitId, todayKey);
      notifyDatabaseChanged();
      triggerBackgroundSync();
    },
    [todayKey]
  );

  const deleteHabit = useCallback((habitId: string) => {
    const existing = localStore.getHabitById(habitId);
    if (!existing) return;
    const now = Date.now();
    localStore.updateHabit(habitId, {
      deletedAt: now,
      isDirty: true,
      updatedAt: now,
    });
    notifyDatabaseChanged();
    triggerBackgroundSync();
  }, []);

  const toggleBinaryHabit = useCallback(
    (habitId: string, targetDateKey = activeDateKey) => {
      const habit = localStore.getHabitById(habitId);
      if (!habit) return;

      const logId = `${habitId}_${targetDateKey}`;
      const existingLog = localStore.getHabitLogById(logId);
      const now = Date.now();
      const willComplete =
        !existingLog ||
        Boolean(existingLog.deletedAt) ||
        (!existingLog.isCompleted && existingLog.status !== 'completed');

      localStore.upsertHabitLog({
        id: logId,
        habitId,
        userId: habit.userId || userId,
        dateKey: targetDateKey,
        completedCount: willComplete ? habit.targetPerDay : 0,
        isCompleted: willComplete,
        status: willComplete ? 'completed' : 'partial',
        isDirty: true,
        deletedAt: willComplete ? null : now,
        updatedAt: now,
      });

      recalculateAndPersistHabitStreak(habitId, todayKey);
      notifyDatabaseChanged();
      triggerBackgroundSync();
    },
    [activeDateKey, todayKey, userId]
  );

  const adjustQuantitativeHabit = useCallback(
    (habitId: string, delta: 1 | -1, targetDateKey = activeDateKey) => {
      const habit = localStore.getHabitById(habitId);
      if (!habit) return;

      const logId = `${habitId}_${targetDateKey}`;
      const existingLog = localStore.getHabitLogById(logId);
      const currentCount =
        existingLog && !existingLog.deletedAt ? existingLog.completedCount : 0;
      const nextCount = Math.max(0, currentCount + delta);
      const isCompleted = nextCount >= Math.max(1, habit.targetPerDay);
      const now = Date.now();

      localStore.upsertHabitLog({
        id: logId,
        habitId,
        userId: habit.userId || userId,
        dateKey: targetDateKey,
        completedCount: nextCount,
        isCompleted,
        status: isCompleted ? 'completed' : 'partial',
        isDirty: true,
        deletedAt: nextCount === 0 ? now : null,
        updatedAt: now,
      });

      recalculateAndPersistHabitStreak(habitId, todayKey);
      notifyDatabaseChanged();
      triggerBackgroundSync();
    },
    [activeDateKey, todayKey, userId]
  );

  const toggleRestShield = useCallback(
    (habitId: string, targetDateKey = activeDateKey) => {
      const habit = localStore.getHabitById(habitId);
      if (!habit) return;

      const logId = `${habitId}_${targetDateKey}`;
      const existingLog = localStore.getHabitLogById(logId);
      const isCurrentlyShielded =
        existingLog && !existingLog.deletedAt && existingLog.status === 'rest_shield';
      const now = Date.now();

      if (!isCurrentlyShielded && shieldStats.available <= 0) {
        return;
      }

      localStore.upsertHabitLog({
        id: logId,
        habitId,
        userId: habit.userId || userId,
        dateKey: targetDateKey,
        completedCount: 0,
        isCompleted: false,
        status: isCurrentlyShielded ? 'partial' : 'rest_shield',
        isDirty: true,
        deletedAt: isCurrentlyShielded ? now : null,
        updatedAt: now,
      });

      recalculateAndPersistHabitStreak(habitId, todayKey);
      notifyDatabaseChanged();
      triggerBackgroundSync();
    },
    [activeDateKey, shieldStats.available, todayKey, userId]
  );

  const togglePauseHabit = useCallback(
    (habitId: string, pausedUntil: string | null = null) => {
      const habit = localStore.getHabitById(habitId);
      if (!habit) return;
      const nextPaused = !habit.isPaused;

      localStore.updateHabit(habitId, {
        isPaused: nextPaused,
        pausedUntil: nextPaused ? pausedUntil : null,
        isDirty: true,
        updatedAt: Date.now(),
      });

      recalculateAndPersistHabitStreak(habitId, todayKey);
      notifyDatabaseChanged();
      triggerBackgroundSync();
    },
    [todayKey]
  );

  return {
    todayKey,
    yesterdayKey,
    activeDateKey,
    setActiveDateKey,
    habits,
    rawHabits,
    allLogs,
    rewards,
    shieldStats,
    yesterdayPendingCount,
    createHabit,
    updateHabit,
    deleteHabit,
    toggleBinaryHabit,
    adjustQuantitativeHabit,
    toggleRestShield,
    togglePauseHabit,
  };
}
