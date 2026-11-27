import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import type {
  TaskCategory,
  TaskPriority,
  TaskRecord,
} from '@organiza/shared/schema';
import {
  getTodayDateKey,
  localStore,
  nextMonotonicTimestamp,
  notifyDatabaseChanged,
  subscribeDatabaseChanges,
} from '../../db/client';
import { triggerBackgroundSync } from '../../db/sync';
import {
  cancelTaskReminderNotification,
  scheduleTaskReminderNotification,
} from '../../services/notifications';
import { insertTaskOfflineFirst, type CreateTaskInput } from '../today/useTodayCockpit';
import {
  computeSnoozeTarget,
  isTaskInFlaggedSmartList,
  isTaskInScheduledSmartList,
  isTaskInTodaySmartList,
  isTaskOverdue,
  sortReminderTasks,
  type ReminderSmartCounts,
  type SnoozePreset,
  type SnoozeTarget,
} from './reminderUtils';

export function snoozeReminderOfflineFirst(
  taskId: string,
  preset: SnoozePreset
): SnoozeTarget | null {
  const existing = localStore.getTaskById(taskId);
  if (!existing) return null;

  const target = computeSnoozeTarget(preset);
  const now = nextMonotonicTimestamp(existing.updatedAt);

  localStore.updateTask(taskId, {
    dueDate: target.dueDate,
    reminderAt: target.reminderAt,
    category: 'reminder',
    isCompleted: false,
    completedAt: null,
    notified: false,
    notificationId: null,
    isDirty: true,
    updatedAt: now,
  });

  if (existing.notificationId) {
    void cancelTaskReminderNotification(existing.notificationId);
  }

  notifyDatabaseChanged();
  triggerBackgroundSync();

  if (Platform.OS !== 'web') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }

  void scheduleTaskReminderNotification({
    taskId,
    title: existing.title,
    notes: existing.notes,
    reminderAtMs: target.reminderAt,
  }).then((notificationId) => {
    if (notificationId) {
      const latest = localStore.getTaskById(taskId);
      localStore.updateTask(taskId, {
        notificationId,
        isDirty: true,
        updatedAt: nextMonotonicTimestamp(latest?.updatedAt ?? now),
      });
      notifyDatabaseChanged();
      triggerBackgroundSync();
    }
  });

  return target;
}

export interface UpdateReminderInput {
  title?: string;
  notes?: string | null;
  category?: TaskCategory;
  priority?: TaskPriority;
  isFlagged?: boolean;
  dueDate?: string | null;
  reminderAt?: number | null;
}

export function useRemindersManager(userId = '') {
  const [tasks, setTasks] = useState<TaskRecord[]>(() =>
    sortReminderTasks(localStore.getTasks())
  );

  const refreshTasks = useCallback(() => {
    setTasks(sortReminderTasks(localStore.getTasks()));
  }, []);

  useEffect(() => {
    refreshTasks();
    return subscribeDatabaseChanges(refreshTasks);
  }, [refreshTasks]);

  const todayKey = getTodayDateKey();
  const nowMs = Date.now();

  const counts = useMemo<ReminderSmartCounts>(() => {
    let today = 0;
    let overdue = 0;
    let scheduled = 0;
    let allPending = 0;
    let flagged = 0;
    let alerts = 0;

    for (const task of tasks) {
      if (!task.isCompleted) {
        allPending += 1;
        if (task.reminderAt) alerts += 1;
      }
      if (isTaskOverdue(task, nowMs, todayKey)) overdue += 1;
      if (isTaskInTodaySmartList(task, nowMs, todayKey)) today += 1;
      if (isTaskInScheduledSmartList(task)) scheduled += 1;
      if (isTaskInFlaggedSmartList(task)) flagged += 1;
    }

    return {
      today,
      overdue,
      scheduled,
      allPending,
      allTotal: tasks.length,
      flagged,
      alerts,
    };
  }, [tasks, nowMs, todayKey]);

  const createReminder = useCallback(
    (input: CreateTaskInput) => {
      return insertTaskOfflineFirst({ ...input, userId });
    },
    [userId]
  );

  const updateReminder = useCallback(
    (taskId: string, patch: UpdateReminderInput) => {
      const existing = localStore.getTaskById(taskId);
      if (!existing) return;

      const now = nextMonotonicTimestamp(existing.updatedAt);
      const nextReminderAt =
        patch.reminderAt !== undefined ? patch.reminderAt : existing.reminderAt;
      const reminderChanged =
        patch.reminderAt !== undefined && patch.reminderAt !== existing.reminderAt;

      const nextTitle =
        patch.title !== undefined ? patch.title.trim() || existing.title : existing.title;
      const nextNotes =
        patch.notes !== undefined ? patch.notes?.trim() || null : existing.notes;
      const nextDueDate =
        patch.dueDate !== undefined
          ? patch.dueDate
          : reminderChanged && nextReminderAt
            ? getTodayDateKey(new Date(nextReminderAt))
            : existing.dueDate;

      localStore.updateTask(taskId, {
        title: nextTitle,
        notes: nextNotes,
        category: patch.category ?? existing.category,
        priority: patch.priority ?? existing.priority,
        isFlagged:
          patch.isFlagged !== undefined ? patch.isFlagged : existing.isFlagged,
        dueDate: nextDueDate,
        reminderAt: nextReminderAt,
        notified: reminderChanged ? false : existing.notified,
        notificationId: reminderChanged ? null : existing.notificationId,
        isDirty: true,
        updatedAt: now,
      });

      if (reminderChanged && existing.notificationId) {
        void cancelTaskReminderNotification(existing.notificationId);
      }

      notifyDatabaseChanged();
      triggerBackgroundSync();

      if (
        reminderChanged &&
        nextReminderAt &&
        nextReminderAt > Date.now() &&
        !existing.isCompleted
      ) {
        void scheduleTaskReminderNotification({
          taskId,
          title: nextTitle,
          notes: nextNotes,
          reminderAtMs: nextReminderAt,
        }).then((notificationId) => {
          if (notificationId) {
            const latest = localStore.getTaskById(taskId);
            localStore.updateTask(taskId, {
              notificationId,
              isDirty: true,
              updatedAt: nextMonotonicTimestamp(latest?.updatedAt ?? now),
            });
            notifyDatabaseChanged();
            triggerBackgroundSync();
          }
        });
      }
    },
    []
  );

  const toggleComplete = useCallback((taskId: string) => {
    const existing = localStore.getTaskById(taskId);
    if (!existing) return;

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
    } else if (
      !nextCompleted &&
      existing.reminderAt &&
      existing.reminderAt > Date.now()
    ) {
      void scheduleTaskReminderNotification({
        taskId,
        title: existing.title,
        notes: existing.notes,
        reminderAtMs: existing.reminderAt,
      }).then((notificationId) => {
        if (notificationId) {
          const latest = localStore.getTaskById(taskId);
          localStore.updateTask(taskId, {
            notificationId,
            isDirty: true,
            updatedAt: nextMonotonicTimestamp(latest?.updatedAt ?? now),
          });
          notifyDatabaseChanged();
          triggerBackgroundSync();
        }
      });
    }

    notifyDatabaseChanged();
    triggerBackgroundSync();
  }, []);

  const toggleFlag = useCallback((taskId: string) => {
    const existing = localStore.getTaskById(taskId);
    if (!existing) return;

    const now = nextMonotonicTimestamp(existing.updatedAt);
    localStore.updateTask(taskId, {
      isFlagged: !existing.isFlagged,
      isDirty: true,
      updatedAt: now,
    });

    notifyDatabaseChanged();
    triggerBackgroundSync();
  }, []);

  const deleteReminder = useCallback((taskId: string) => {
    const existing = localStore.getTaskById(taskId);
    if (!existing) return;

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

  const snoozeReminder = useCallback(
    (taskId: string, preset: SnoozePreset) => {
      return snoozeReminderOfflineFirst(taskId, preset);
    },
    []
  );

  return {
    todayKey,
    tasks,
    counts,
    createReminder,
    updateReminder,
    toggleComplete,
    toggleFlag,
    deleteReminder,
    snoozeReminder,
  };
}
