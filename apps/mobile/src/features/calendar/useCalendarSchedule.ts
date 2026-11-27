import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  TaskRecord,
  WorkBlockRecord,
  WorkBlockType,
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
  cancelTaskReminderNotification,
  scheduleTaskReminderNotification,
} from '../../services/notifications';
import {
  formatReminderClock,
  snoozeReminderOfflineFirst,
  type SnoozePreset,
} from '../reminders';

export type CalendarTimelineItem =
  | { kind: 'work_block'; id: string; sortTime: string; block: WorkBlockRecord }
  | { kind: 'reminder'; id: string; sortTime: string; task: TaskRecord };

function readTimedRemindersForDate(dateKey: string): TaskRecord[] {
  return localStore
    .getTasks()
    .filter(
      (t) =>
        typeof t.reminderAt === 'number' &&
        Number.isFinite(t.reminderAt) &&
        getTodayDateKey(new Date(t.reminderAt)) === dateKey
    )
    .sort((a, b) => (a.reminderAt ?? 0) - (b.reminderAt ?? 0));
}

function readReminderDateKeys(): Set<string> {
  const keys = new Set<string>();
  for (const t of localStore.getTasks()) {
    if (
      !t.isCompleted &&
      typeof t.reminderAt === 'number' &&
      Number.isFinite(t.reminderAt)
    ) {
      keys.add(getTodayDateKey(new Date(t.reminderAt)));
    }
  }
  return keys;
}

export interface CreateWorkBlockInput {
  title: string;
  blockType?: WorkBlockType;
  dateKey?: string;
  startTime: string;
  endTime: string;
  locationOrLink?: string;
  isRecurring?: boolean;
  userId?: string;
}

export function insertWorkBlockOfflineFirst(input: CreateWorkBlockInput): WorkBlockRecord {
  const now = nextMonotonicTimestamp();
  const record: WorkBlockRecord = {
    id: createLocalId(),
    userId: input.userId || localStore.getActiveUserId(),
    title: input.title.trim(),
    blockType: input.blockType ?? 'deep_work',
    dateKey: input.dateKey ?? getTodayDateKey(),
    startTime: input.startTime,
    endTime: input.endTime,
    locationOrLink: input.locationOrLink?.trim() || null,
    isRecurring: input.isRecurring ?? false,
    recurrenceDays: input.isRecurring ? '[1,2,3,4,5]' : null,
    isDirty: true,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  localStore.upsertWorkBlock(record);
  notifyDatabaseChanged();
  triggerBackgroundSync();
  return record;
}

/**
 * FASE 2: Hook Offline-First para Calendario Visual, Horarios de Trabajo y Time-Blocking
 * (Compatible con Web, iOS y Android).
 */
export function useCalendarSchedule(initialDateKey = getTodayDateKey(), userId = '') {
  const [selectedDateKey, setSelectedDateKey] = useState(initialDateKey);
  const [blocks, setBlocks] = useState<WorkBlockRecord[]>(() =>
    localStore.getWorkBlocksForDate(initialDateKey)
  );
  const [timedReminders, setTimedReminders] = useState<TaskRecord[]>(() =>
    readTimedRemindersForDate(initialDateKey)
  );
  const [reminderDateKeys, setReminderDateKeys] = useState<Set<string>>(() =>
    readReminderDateKeys()
  );

  const refreshSchedule = useCallback(() => {
    setBlocks(localStore.getWorkBlocksForDate(selectedDateKey));
    setTimedReminders(readTimedRemindersForDate(selectedDateKey));
    setReminderDateKeys(readReminderDateKeys());
  }, [selectedDateKey]);

  useEffect(() => {
    refreshSchedule();
    return subscribeDatabaseChanges(refreshSchedule);
  }, [refreshSchedule]);

  const timelineItems = useMemo<CalendarTimelineItem[]>(() => {
    const blockItems: CalendarTimelineItem[] = blocks.map((block) => ({
      kind: 'work_block',
      id: block.id,
      sortTime: block.startTime,
      block,
    }));

    const reminderItems: CalendarTimelineItem[] = timedReminders.map((task) => ({
      kind: 'reminder',
      id: task.id,
      sortTime: formatReminderClock(task.reminderAt) ?? '00:00',
      task,
    }));

    return [...blockItems, ...reminderItems].sort((a, b) => {
      const timeCmp = a.sortTime.localeCompare(b.sortTime);
      if (timeCmp !== 0) return timeCmp;
      if (a.kind !== b.kind) {
        return a.kind === 'work_block' ? -1 : 1;
      }
      if (a.kind === 'reminder' && b.kind === 'reminder') {
        if (a.task.isCompleted !== b.task.isCompleted) {
          return a.task.isCompleted ? 1 : -1;
        }
      }
      return 0;
    });
  }, [blocks, timedReminders]);

  const addWorkBlock = useCallback(
    (input: CreateWorkBlockInput) => {
      return insertWorkBlockOfflineFirst({
        ...input,
        dateKey: input.dateKey ?? selectedDateKey,
        userId,
      });
    },
    [selectedDateKey, userId]
  );

  const removeWorkBlock = useCallback((blockId: string) => {
    const existing = localStore.getWorkBlockById(blockId);
    const now = nextMonotonicTimestamp(existing?.updatedAt);
    localStore.updateWorkBlock(blockId, {
      deletedAt: now,
      isDirty: true,
      updatedAt: now,
    });
    notifyDatabaseChanged();
    triggerBackgroundSync();
  }, []);

  const toggleReminderComplete = useCallback((taskId: string) => {
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

  const snoozeReminder = useCallback(
    (taskId: string, preset: SnoozePreset) => {
      return snoozeReminderOfflineFirst(taskId, preset);
    },
    []
  );

  return {
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
  };
}
