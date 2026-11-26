import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  TaskRecord,
  HabitRecord,
  TaskCategory,
  TaskPriority,
  HabitFrequency,
  HabitType,
  HabitTimeOfDay,
} from '@organiza/shared/schema';
import {
  localStore,
  createLocalId,
  getTodayDateKey,
  nextMonotonicTimestamp,
  notifyDatabaseChanged,
  subscribeDatabaseChanges,
} from '../../db/client';
import { triggerBackgroundSync } from '../../db/sync';
import {
  scheduleTaskReminderNotification,
  cancelTaskReminderNotification,
} from '../../services/notifications';

export interface HabitWithDailyStatus extends HabitRecord {
  completedToday: boolean;
}

export interface CreateTaskInput {
  title: string;
  notes?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  dueDate?: string | null;
  reminderAt?: number | null;
  sourcePageId?: string | null;
  sourceBlockId?: string | null;
  userId?: string;
}

export interface CreateHabitInput {
  title: string;
  icon?: string;
  habitType?: HabitType;
  unit?: string | null;
  frequency?: HabitFrequency;
  scheduledDays?: number[];
  targetPerDay?: number;
  weeklyGoal?: number | null;
  timeOfDay?: HabitTimeOfDay;
  reminderTime?: string | null;
  userId?: string;
}

export interface CockpitMetrics {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  totalHabits: number;
  completedHabits: number;
  overallProgressPercent: number;
}

function readTodaySnapshotFromLocalStore(todayKey: string): {
  taskList: TaskRecord[];
  habitList: HabitWithDailyStatus[];
} {
  const allTasks = localStore.getTasks();

  const sortedTasks = [...allTasks].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1;
    }
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return b.createdAt - a.createdAt;
  });

  const activeHabits = localStore.getHabits();
  const todayLogs = localStore.getHabitLogsForDate(todayKey);

  const completedHabitIds = new Set(
    todayLogs.filter((log) => log.isCompleted).map((log) => log.habitId)
  );

  const habitList: HabitWithDailyStatus[] = activeHabits.map((habit) => ({
    ...habit,
    completedToday: completedHabitIds.has(habit.id),
  }));

  return {
    taskList: sortedTasks,
    habitList,
  };
}

export function insertTaskOfflineFirst(input: CreateTaskInput): TaskRecord {
  const now = nextMonotonicTimestamp();
  const id = createLocalId();
  const todayKey = getTodayDateKey();

  const record: TaskRecord = {
    id,
    userId: input.userId || localStore.getActiveUserId(),
    title: input.title.trim(),
    notes: input.notes?.trim() || null,
    category: input.category ?? 'today',
    priority: input.priority ?? 2,
    isCompleted: false,
    completedAt: null,
    dueDate: input.dueDate !== undefined ? input.dueDate : todayKey,
    reminderAt: input.reminderAt ?? null,
    notificationId: null,
    sourcePageId: input.sourcePageId ?? null,
    sourceBlockId: input.sourceBlockId ?? null,
    isDirty: true,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  localStore.upsertTask(record);
  notifyDatabaseChanged();
  triggerBackgroundSync();

  if (record.reminderAt && record.reminderAt > now) {
    void scheduleTaskReminderNotification({
      taskId: record.id,
      title: record.title,
      notes: record.notes,
      reminderAtMs: record.reminderAt,
    }).then((notificationId) => {
      if (notificationId) {
        const current = localStore.getTaskById(record.id);
        localStore.updateTask(record.id, {
          notificationId,
          updatedAt: nextMonotonicTimestamp(current?.updatedAt ?? record.updatedAt),
          isDirty: true,
        });
        notifyDatabaseChanged();
        triggerBackgroundSync();
      }
    });
  }

  return record;
}

export function insertHabitOfflineFirst(input: CreateHabitInput): HabitRecord {
  const now = nextMonotonicTimestamp();
  const freq = input.frequency ?? 'daily';
  const defaultDays =
    freq === 'weekdays'
      ? [1, 2, 3, 4, 5]
      : freq === 'weekends'
        ? [0, 6]
        : [0, 1, 2, 3, 4, 5, 6];
  const scheduledDaysJson = JSON.stringify(input.scheduledDays ?? defaultDays);

  const record: HabitRecord = {
    id: createLocalId(),
    userId: input.userId || localStore.getActiveUserId(),
    title: input.title.trim(),
    icon: input.icon ?? 'Sparkles',
    habitType: input.habitType ?? 'binary',
    unit: input.unit ?? null,
    frequency: freq,
    scheduledDays: scheduledDaysJson,
    targetPerDay: Math.max(1, input.targetPerDay ?? 1),
    weeklyGoal: input.weeklyGoal ?? null,
    streak: 0,
    bestStreak: 0,
    isPaused: false,
    pausedUntil: null,
    timeOfDay: input.timeOfDay ?? 'any',
    reminderTime: input.reminderTime ?? null,
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
}

/**
 * Hook React para la Vista "Hoy" (FASE 1: Hábitos + Tareas/Recordatorios).
 * Compatible 100% con Web, iOS y Android a 0 ms de latencia.
 */
export function useTodayCockpit(userId = '') {
  const todayKey = getTodayDateKey();
  const [snapshot, setSnapshot] = useState(() =>
    readTodaySnapshotFromLocalStore(todayKey)
  );

  const refreshFromSqlite = useCallback(() => {
    setSnapshot(readTodaySnapshotFromLocalStore(getTodayDateKey()));
  }, []);

  useEffect(() => {
    return subscribeDatabaseChanges(refreshFromSqlite);
  }, [refreshFromSqlite]);

  const createTask = useCallback(
    (input: CreateTaskInput) => {
      return insertTaskOfflineFirst({ ...input, userId });
    },
    [userId]
  );

  const toggleTask = useCallback((taskId: string) => {
    const existing = localStore.getTaskById(taskId);
    if (!existing) {
      return;
    }

    const now = nextMonotonicTimestamp(existing.updatedAt);
    const nextCompleted = !existing.isCompleted;

    localStore.updateTask(taskId, {
      isCompleted: nextCompleted,
      completedAt: nextCompleted ? now : null,
      isDirty: true,
      updatedAt: now,
    });

    if (nextCompleted && existing.notificationId) {
      void cancelTaskReminderNotification(existing.notificationId);
    }

    notifyDatabaseChanged();
    triggerBackgroundSync();
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    const existing = localStore.getTaskById(taskId);
    if (!existing) {
      return;
    }

    const now = nextMonotonicTimestamp(existing.updatedAt);
    localStore.updateTask(taskId, {
      deletedAt: now,
      isDirty: true,
      updatedAt: now,
    });

    if (existing.notificationId) {
      void cancelTaskReminderNotification(existing.notificationId);
    }

    notifyDatabaseChanged();
    triggerBackgroundSync();
  }, []);

  const createHabit = useCallback(
    (input: CreateHabitInput) => {
      return insertHabitOfflineFirst({ ...input, userId });
    },
    [userId]
  );

  const toggleHabitForToday = useCallback(
    (habitId: string) => {
      const currentDayKey = getTodayDateKey();
      const habit = localStore.getHabitById(habitId);
      if (!habit) {
        return;
      }

      const deterministicLogId = `${habitId}_${currentDayKey}`;
      const existingLog = localStore.getHabitLogById(deterministicLogId);

      const now = nextMonotonicTimestamp(
        Math.max(habit.updatedAt, existingLog?.updatedAt ?? 0)
      );
      const willComplete =
        !existingLog || !existingLog.isCompleted || Boolean(existingLog.deletedAt);

      localStore.upsertHabitLog({
        id: deterministicLogId,
        habitId,
        userId: habit.userId || userId || localStore.getActiveUserId(),
        dateKey: currentDayKey,
        completedCount: willComplete ? habit.targetPerDay : 0,
        isCompleted: willComplete,
        status: willComplete ? 'completed' : 'partial',
        isDirty: true,
        deletedAt: willComplete ? null : now,
        updatedAt: now,
      });

      const updatedStreak = willComplete
        ? habit.streak + 1
        : Math.max(0, habit.streak - 1);

      localStore.updateHabit(habitId, {
        streak: updatedStreak,
        bestStreak: Math.max(habit.bestStreak ?? 0, updatedStreak),
        isDirty: true,
        updatedAt: now,
      });

      notifyDatabaseChanged();
      triggerBackgroundSync();
    },
    [userId]
  );

  const metrics = useMemo<CockpitMetrics>(() => {
    const totalTasks = snapshot.taskList.length;
    const completedTasks = snapshot.taskList.filter((t) => t.isCompleted).length;
    const pendingTasks = totalTasks - completedTasks;

    const totalHabits = snapshot.habitList.length;
    const completedHabits = snapshot.habitList.filter((h) => h.completedToday).length;

    const totalUnits = totalTasks + totalHabits;
    const completedUnits = completedTasks + completedHabits;
    const overallProgressPercent =
      totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      totalHabits,
      completedHabits,
      overallProgressPercent,
    };
  }, [snapshot]);

  return {
    todayKey,
    tasks: snapshot.taskList,
    habits: snapshot.habitList,
    metrics,
    createTask,
    toggleTask,
    deleteTask,
    createHabit,
    toggleHabitForToday,
    refreshFromSqlite,
  };
}
