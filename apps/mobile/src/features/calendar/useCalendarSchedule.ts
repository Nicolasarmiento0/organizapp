import { useCallback, useEffect, useState } from 'react';
import type { WorkBlockRecord, WorkBlockType } from '@organiza/shared/schema';
import {
  localStore,
  createLocalId,
  getTodayDateKey,
  nextMonotonicTimestamp,
  notifyDatabaseChanged,
  subscribeDatabaseChanges,
} from '../../db/client';
import { triggerBackgroundSync } from '../../db/sync';

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

  const refreshBlocks = useCallback(() => {
    setBlocks(localStore.getWorkBlocksForDate(selectedDateKey));
  }, [selectedDateKey]);

  useEffect(() => {
    refreshBlocks();
    return subscribeDatabaseChanges(refreshBlocks);
  }, [refreshBlocks]);

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

  return {
    selectedDateKey,
    setSelectedDateKey,
    blocks,
    addWorkBlock,
    removeWorkBlock,
  };
}
