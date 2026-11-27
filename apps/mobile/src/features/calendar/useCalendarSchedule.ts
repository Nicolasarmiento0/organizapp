import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  HabitLogRecord,
  HabitRecord,
  ShiftTemplateRecord,
  TaskRecord,
  WorkBlockAlertMinutes,
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
  cancelWorkBlockNotification,
  scheduleTaskReminderNotification,
  scheduleWorkBlockNotification,
} from '../../services/notifications';
import {
  formatReminderClock,
  getTaskEffectiveDateKey,
  isTaskOverdue,
  snoozeReminderOfflineFirst,
  sortReminderTasks,
  type SnoozePreset,
} from '../reminders';
import {
  computeHabitStreakStats,
  getDayOfWeekFromDateKey,
  isHabitPausedOnDate,
  isHabitScheduledOnDate,
  parseScheduledDays,
} from '../habits/streakEngine';
import {
  CALENDAR_COLORS,
  DEFAULT_SHIFT_PRESETS,
  computeRestPeriodsFromBlocks,
  dateKeyAndTimeToEpochMs,
  formatDurationShort,
  minutesToTime,
  parseTimeToMinutes,
  shiftDateKeyLocal,
  snapMinutes,
  triggerCalendarHaptic,
  type RestPeriodWindow,
  type Rotation6x4Config,
} from './calendarUtils';

export interface DayActivityDots {
  hasEvent: boolean;
  hasReminder: boolean;
  hasHabit: boolean;
  isRestDay: boolean;
}

export interface AnchoredHabitItem {
  habit: HabitRecord;
  anchorTime: string;
  startMinutes: number;
  isExactTime: boolean;
  activeCount: number;
  completedOnDate: boolean;
  computedStreak: number;
}

export interface EnrichedWorkBlock extends WorkBlockRecord {
  startMinutes: number;
  endMinutes: number;
  accentColor: string;
  linkedTask: TaskRecord | null;
  isOvernightStart?: boolean;
  isOvernightContinuation?: boolean;
}

export interface LiveNextUpInfo {
  status: 'in_progress' | 'upcoming' | 'clear';
  title: string;
  label: string;
  accentColor: string;
}

export type CalendarTimelineItem =
  | { kind: 'work_block'; id: string; sortTime: string; block: WorkBlockRecord }
  | { kind: 'reminder'; id: string; sortTime: string; task: TaskRecord };

export interface CreateWorkBlockInput {
  title: string;
  blockType?: WorkBlockType;
  dateKey?: string;
  startTime: string;
  endTime: string;
  isAllDay?: boolean;
  alertMinutesBefore?: WorkBlockAlertMinutes | null;
  color?: string | null;
  linkedTaskId?: string | null;
  locationOrLink?: string;
  isRecurring?: boolean;
  recurrenceDays?: string | null;
  userId?: string;
}

export interface UpdateWorkBlockInput {
  title?: string;
  blockType?: WorkBlockType;
  dateKey?: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  alertMinutesBefore?: WorkBlockAlertMinutes | null;
  color?: string | null;
  locationOrLink?: string | null;
}

export interface CreateShiftTemplateInput {
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  alertMinutesBefore?: WorkBlockAlertMinutes | null;
  locationOrLink?: string | null;
}

function resolveBlockAccentColor(block: WorkBlockRecord): string {
  if (block.color) return block.color;
  if (block.blockType === 'work_shift') return CALENDAR_COLORS.shiftPurple;
  if (block.blockType === 'meeting') return '#F59E0B';
  if (block.blockType === 'break') return CALENDAR_COLORS.habitEmerald;
  return CALENDAR_COLORS.coral;
}

function scheduleWorkBlockAlertAsync(record: WorkBlockRecord): void {
  if (
    record.isAllDay ||
    record.alertMinutesBefore === null ||
    record.alertMinutesBefore === undefined
  ) {
    return;
  }
  if (
    record.alertMinutesBefore !== 0 &&
    record.alertMinutesBefore !== 15 &&
    record.alertMinutesBefore !== 60
  ) {
    return;
  }

  void scheduleWorkBlockNotification({
    blockId: record.id,
    title: record.title,
    dateKey: record.dateKey,
    startTime: record.startTime,
    alertMinutesBefore: record.alertMinutesBefore,
    locationOrLink: record.locationOrLink,
  }).then((notificationId) => {
    if (notificationId) {
      const latest = localStore.getWorkBlockById(record.id);
      if (!latest || latest.deletedAt) return;
      localStore.updateWorkBlock(record.id, {
        notificationId,
        isDirty: true,
        updatedAt: nextMonotonicTimestamp(latest.updatedAt),
      });
      notifyDatabaseChanged();
      triggerBackgroundSync();
    }
  });
}

export function insertWorkBlockOfflineFirst(
  input: CreateWorkBlockInput
): WorkBlockRecord {
  const now = nextMonotonicTimestamp();
  const isAllDay = Boolean(input.isAllDay);
  const record: WorkBlockRecord = {
    id: createLocalId(),
    userId: input.userId || localStore.getActiveUserId(),
    title: input.title.trim(),
    blockType: input.blockType ?? 'deep_work',
    dateKey: input.dateKey ?? getTodayDateKey(),
    startTime: isAllDay ? '00:00' : input.startTime,
    endTime: isAllDay ? '23:59' : input.endTime,
    isAllDay,
    alertMinutesBefore: isAllDay ? null : (input.alertMinutesBefore ?? null),
    notificationId: null,
    color: input.color ?? null,
    linkedTaskId: input.linkedTaskId ?? null,
    locationOrLink: input.locationOrLink?.trim() || null,
    isRecurring: input.isRecurring ?? false,
    recurrenceDays:
      input.recurrenceDays ?? (input.isRecurring ? '[1,2,3,4,5]' : null),
    isDirty: true,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  localStore.upsertWorkBlock(record);
  notifyDatabaseChanged();
  triggerBackgroundSync();
  scheduleWorkBlockAlertAsync(record);
  return record;
}

function resolveHabitAnchorTime(habit: HabitRecord): {
  anchorTime: string;
  isExactTime: boolean;
} | null {
  const raw = habit.reminderTime?.trim();
  if (raw && /^([01]?\d|2[0-3]):([0-5]\d)$/.test(raw)) {
    const [h, m] = raw.split(':');
    return {
      anchorTime: `${String(Number(h)).padStart(2, '0')}:${m}`,
      isExactTime: true,
    };
  }
  if (habit.timeOfDay === 'morning') {
    return { anchorTime: '08:00', isExactTime: false };
  }
  if (habit.timeOfDay === 'afternoon') {
    return { anchorTime: '14:00', isExactTime: false };
  }
  if (habit.timeOfDay === 'evening') {
    return { anchorTime: '20:00', isExactTime: false };
  }
  return null;
}

/**
 * Hook Offline-First Unificado para Calendario v2:
 * - 3 capas visuales (Eventos/Turnos + Recordatorios + Hábitos anclados)
 * - Gestos táctiles (Mover, Estirar, Toque largo, Drag desde Sin Programar)
 * - Alertas locales escalonadas ($0 USD)
 * - Indicador "Ahora" en vivo
 * - Pintor de Turnos de Trabajo (1-Tap Shift Painter)
 */
export function useCalendarSchedule(
  initialDateKey = getTodayDateKey(),
  userId = ''
) {
  const todayKey = getTodayDateKey();
  const [selectedDateKey, setSelectedDateKey] = useState(initialDateKey);
  const [nowDate, setNowDate] = useState<Date>(() => new Date());

  const [allWorkBlocks, setAllWorkBlocks] = useState<WorkBlockRecord[]>(() =>
    localStore.getAllWorkBlocks()
  );
  const [allTasks, setAllTasks] = useState<TaskRecord[]>(() =>
    localStore.getTasks()
  );
  const [allHabits, setAllHabits] = useState<HabitRecord[]>(() =>
    localStore.getHabits()
  );
  const [allHabitLogs, setAllHabitLogs] = useState<HabitLogRecord[]>(() =>
    localStore.getAllHabitLogs()
  );
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplateRecord[]>(() =>
    localStore.getShiftTemplates()
  );

  const refreshAll = useCallback(() => {
    setAllWorkBlocks(localStore.getAllWorkBlocks());
    setAllTasks(localStore.getTasks());
    setAllHabits(localStore.getHabits());
    setAllHabitLogs(localStore.getAllHabitLogs());
    setShiftTemplates(localStore.getShiftTemplates());
  }, []);

  useEffect(() => {
    refreshAll();
    return subscribeDatabaseChanges(refreshAll);
  }, [refreshAll]);

  // Reloj en vivo cada 30 segundos para la línea "Ahora" y el contador de próximo bloque
  useEffect(() => {
    const interval = setInterval(() => {
      setNowDate(new Date());
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const nowMs = nowDate.getTime();
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  // Mapas pre-indexados para puntos de actividad (eventos, recordatorios, hábitos) en O(1)
  const taskById = useMemo(() => {
    const map = new Map<string, TaskRecord>();
    for (const t of allTasks) {
      map.set(t.id, t);
    }
    return map;
  }, [allTasks]);

  const logsByHabitId = useMemo(() => {
    const map = new Map<string, HabitLogRecord[]>();
    for (const log of allHabitLogs) {
      if (log.deletedAt) continue;
      const list = map.get(log.habitId);
      if (list) list.push(log);
      else map.set(log.habitId, [log]);
    }
    return map;
  }, [allHabitLogs]);

  const {
    exactEventDates,
    restDates,
    recurringBlocks,
    reminderDates,
    scheduledHabitsWithSchedule,
  } = useMemo(() => {
    const evDates = new Set<string>();
    const rDates = new Set<string>();
    const recBlocks: Array<{ block: WorkBlockRecord; days: Set<number> }> = [];

    for (const b of allWorkBlocks) {
      if (b.deletedAt) continue;
      if (b.blockType === 'break') {
        rDates.add(b.dateKey);
      } else {
        evDates.add(b.dateKey);
      }
      if (b.isRecurring) {
        recBlocks.push({
          block: b,
          days: new Set(parseScheduledDays(b.recurrenceDays ?? '[1,2,3,4,5]')),
        });
      }
    }

    const remDates = new Set<string>();
    for (const t of allTasks) {
      if (t.deletedAt || t.isCompleted) continue;
      const effectiveKey = getTaskEffectiveDateKey(t);
      if (effectiveKey) {
        remDates.add(effectiveKey);
      }
    }

    // Hábitos que tienen su día u hora definido
    const habitsWithDef = allHabits.filter((h) => {
      if (h.deletedAt || h.isArchived) return false;
      const hasTime = Boolean(h.reminderTime?.trim()) || h.timeOfDay !== 'any';
      const hasCustomDays = parseScheduledDays(h.scheduledDays).length < 7;
      return hasTime || hasCustomDays;
    });

    return {
      exactEventDates: evDates,
      restDates: rDates,
      recurringBlocks: recBlocks,
      reminderDates: remDates,
      scheduledHabitsWithSchedule: habitsWithDef,
    };
  }, [allWorkBlocks, allTasks, allHabits]);

  const getDayActivityDots = useCallback(
    (dateKey: string): DayActivityDots => {
      const dow = getDayOfWeekFromDateKey(dateKey);
      const hasEvent =
        exactEventDates.has(dateKey) ||
        recurringBlocks.some(
          (entry) =>
            entry.block.dateKey <= dateKey && entry.days.has(dow)
        );
      const hasReminder = reminderDates.has(dateKey);
      const isRestDay = restDates.has(dateKey);
      const hasHabit =
        isRestDay ||
        scheduledHabitsWithSchedule.some(
          (h) =>
            !isHabitPausedOnDate(h, dateKey) && isHabitScheduledOnDate(h, dateKey)
        );
      return { hasEvent, hasReminder, hasHabit, isRestDay };
    },
    [
      exactEventDates,
      restDates,
      recurringBlocks,
      reminderDates,
      scheduledHabitsWithSchedule,
    ]
  );

  const upcomingRestPeriods = useMemo<RestPeriodWindow[]>(
    () => computeRestPeriodsFromBlocks(allWorkBlocks, todayKey),
    [allWorkBlocks, todayKey]
  );

  // Bloques activos del día seleccionado
  const blocks = useMemo<WorkBlockRecord[]>(() => {
    const exact = allWorkBlocks.filter((b) => b.dateKey === selectedDateKey);
    const exactIds = new Set(exact.map((b) => b.id));
    const dow = getDayOfWeekFromDateKey(selectedDateKey);

    const rec = recurringBlocks
      .filter(
        (entry) =>
          !exactIds.has(entry.block.id) &&
          entry.block.dateKey <= selectedDateKey &&
          entry.days.has(dow)
      )
      .map((entry) => entry.block);

    return [...exact, ...rec].sort((a, b) => {
      if (Boolean(a.isAllDay) !== Boolean(b.isAllDay)) {
        return a.isAllDay ? -1 : 1;
      }
      return a.startTime.localeCompare(b.startTime);
    });
  }, [allWorkBlocks, recurringBlocks, selectedDateKey]);

  const allDayBlocks = useMemo<EnrichedWorkBlock[]>(() => {
    return blocks
      .filter((b) => Boolean(b.isAllDay))
      .map((b) => ({
        ...b,
        startMinutes: 0,
        endMinutes: 1440,
        accentColor: resolveBlockAccentColor(b),
        linkedTask: b.linkedTaskId ? taskById.get(b.linkedTaskId) ?? null : null,
      }));
  }, [blocks, taskById]);

  const timedBlocks = useMemo<EnrichedWorkBlock[]>(() => {
    const sameDayTimed: EnrichedWorkBlock[] = blocks
      .filter((b) => !b.isAllDay)
      .map((b) => {
        const startMin = parseTimeToMinutes(b.startTime);
        const rawEndMin = parseTimeToMinutes(b.endTime);
        const crossesMidnight = rawEndMin < startMin;
        const endMin = crossesMidnight
          ? 24 * 60
          : Math.max(startMin + 15, rawEndMin);
        return {
          ...b,
          startMinutes: startMin,
          endMinutes: endMin,
          accentColor: resolveBlockAccentColor(b),
          linkedTask: b.linkedTaskId ? taskById.get(b.linkedTaskId) ?? null : null,
          isOvernightStart: crossesMidnight,
          isOvernightContinuation: false,
        };
      });

    // Continuación de turnos nocturnos iniciados el día anterior (ej. 22:00 – 06:00)
    const prevDateKey = shiftDateKeyLocal(selectedDateKey, -1);
    const prevNightBlocks: EnrichedWorkBlock[] = allWorkBlocks
      .filter((b) => {
        if (b.deletedAt || b.isAllDay || b.dateKey !== prevDateKey) return false;
        const s = parseTimeToMinutes(b.startTime);
        const e = parseTimeToMinutes(b.endTime);
        return e < s && e > 0;
      })
      .map((b) => ({
        ...b,
        startMinutes: 0,
        endMinutes: Math.max(15, parseTimeToMinutes(b.endTime)),
        accentColor: resolveBlockAccentColor(b),
        linkedTask: b.linkedTaskId ? taskById.get(b.linkedTaskId) ?? null : null,
        isOvernightStart: false,
        isOvernightContinuation: true,
      }));

    return [...prevNightBlocks, ...sameDayTimed].sort(
      (a, b) => a.startMinutes - b.startMinutes
    );
  }, [allWorkBlocks, blocks, selectedDateKey, taskById]);

  const linkedTaskIdsOnDate = useMemo(() => {
    const set = new Set<string>();
    for (const b of blocks) {
      if (b.linkedTaskId) set.add(b.linkedTaskId);
    }
    return set;
  }, [blocks]);

  // Capa 2: Recordatorios proyectados en su hora exacta (excluyendo los ya convertidos en bloque hoy)
  const timedReminders = useMemo<TaskRecord[]>(() => {
    return allTasks
      .filter(
        (t) =>
          !t.deletedAt &&
          !linkedTaskIdsOnDate.has(t.id) &&
          typeof t.reminderAt === 'number' &&
          Number.isFinite(t.reminderAt) &&
          getTodayDateKey(new Date(t.reminderAt)) === selectedDateKey
      )
      .sort((a, b) => (a.reminderAt ?? 0) - (b.reminderAt ?? 0));
  }, [allTasks, linkedTaskIdsOnDate, selectedDateKey]);

  // Recordatorios atrasados (solo al mirar Hoy, para que nunca se pierdan)
  const overdueReminders = useMemo<TaskRecord[]>(() => {
    if (selectedDateKey !== todayKey) return [];
    return allTasks
      .filter(
        (t) =>
          !t.deletedAt &&
          !t.isCompleted &&
          typeof t.reminderAt === 'number' &&
          Number.isFinite(t.reminderAt) &&
          isTaskOverdue(t, nowMs, todayKey)
      )
      .sort((a, b) => (a.reminderAt ?? 0) - (b.reminderAt ?? 0));
  }, [allTasks, selectedDateKey, todayKey, nowMs]);

  // Capa 3: Hábitos anclados en su franja horaria recomendada
  const anchoredHabits = useMemo<AnchoredHabitItem[]>(() => {
    const result: AnchoredHabitItem[] = [];
    for (const habit of allHabits) {
      if (habit.deletedAt || habit.isArchived) continue;
      if (isHabitPausedOnDate(habit, selectedDateKey)) continue;
      if (!isHabitScheduledOnDate(habit, selectedDateKey)) continue;

      const anchor = resolveHabitAnchorTime(habit);
      if (!anchor) continue;

      const habitLogsList = logsByHabitId.get(habit.id) ?? [];
      const activeLog = habitLogsList.find((l) => l.dateKey === selectedDateKey);
      const stats = computeHabitStreakStats(habit, habitLogsList, todayKey);
      const computedStreak = Math.max(habit.streak, stats.currentStreak);
      const completedOnDate = Boolean(
        activeLog && (activeLog.status === 'completed' || activeLog.isCompleted)
      );

      result.push({
        habit,
        anchorTime: anchor.anchorTime,
        startMinutes: parseTimeToMinutes(anchor.anchorTime),
        isExactTime: anchor.isExactTime,
        activeCount: activeLog ? activeLog.completedCount : 0,
        completedOnDate,
        computedStreak,
      });
    }
    return result.sort((a, b) => a.startMinutes - b.startMinutes);
  }, [allHabits, logsByHabitId, selectedDateKey, todayKey]);

  // Bandeja "Sin Programar": tareas/recordatorios de hoy (o del día seleccionado) sin hora fija
  const unscheduledTasks = useMemo<TaskRecord[]>(() => {
    const filtered = allTasks.filter((t) => {
      if (t.deletedAt || t.isCompleted) return false;
      if (t.reminderAt !== null && t.reminderAt !== undefined) return false;
      if (linkedTaskIdsOnDate.has(t.id)) return false;

      if (selectedDateKey === todayKey) {
        return !t.dueDate || t.dueDate <= todayKey;
      }
      return t.dueDate === selectedDateKey;
    });
    return sortReminderTasks(filtered);
  }, [allTasks, linkedTaskIdsOnDate, selectedDateKey, todayKey]);

  // Banner "Ahora" en vivo: bloque en curso o cuánto falta para el siguiente
  const liveNextUp = useMemo<LiveNextUpInfo>(() => {
    if (selectedDateKey !== todayKey) {
      const firstBlock = timedBlocks[0];
      if (firstBlock) {
        return {
          status: 'upcoming',
          title: firstBlock.title,
          label: `Inicia a las ${firstBlock.startTime}`,
          accentColor: firstBlock.accentColor,
        };
      }
      return {
        status: 'clear',
        title: 'Día libre de bloques',
        label: 'Mantén presionado un hueco para agendar',
        accentColor: CALENDAR_COLORS.coral,
      };
    }

    const activeBlock = timedBlocks.find(
      (b) => nowMinutes >= b.startMinutes && nowMinutes < b.endMinutes
    );
    if (activeBlock) {
      const remaining = Math.max(1, activeBlock.endMinutes - nowMinutes);
      return {
        status: 'in_progress',
        title: activeBlock.title,
        label: `En curso · restan ${formatDurationShort(remaining)}`,
        accentColor: activeBlock.accentColor,
      };
    }

    type UpcomingCandidate = {
      startMinutes: number;
      title: string;
      accentColor: string;
    };
    const candidates: UpcomingCandidate[] = [];

    for (const b of timedBlocks) {
      if (b.startMinutes > nowMinutes) {
        candidates.push({
          startMinutes: b.startMinutes,
          title: b.title,
          accentColor: b.accentColor,
        });
      }
    }
    for (const r of timedReminders) {
      if (r.isCompleted || !r.reminderAt) continue;
      const d = new Date(r.reminderAt);
      const mins = d.getHours() * 60 + d.getMinutes();
      if (mins > nowMinutes) {
        candidates.push({
          startMinutes: mins,
          title: r.title,
          accentColor: CALENDAR_COLORS.reminderCoral,
        });
      }
    }
    for (const h of anchoredHabits) {
      if (!h.completedOnDate && h.startMinutes > nowMinutes) {
        candidates.push({
          startMinutes: h.startMinutes,
          title: h.habit.title,
          accentColor: CALENDAR_COLORS.habitEmerald,
        });
      }
    }

    candidates.sort((a, b) => a.startMinutes - b.startMinutes);
    const next = candidates[0];
    if (next) {
      const delta = next.startMinutes - nowMinutes;
      return {
        status: 'upcoming',
        title: next.title,
        label: `Próximo en ${formatDurationShort(delta)} · ${minutesToTime(next.startMinutes)}`,
        accentColor: next.accentColor,
      };
    }

    return {
      status: 'clear',
      title: 'Agenda despejada',
      label: 'Sin más bloques programados por hoy',
      accentColor: CALENDAR_COLORS.coral,
    };
  }, [
    selectedDateKey,
    todayKey,
    timedBlocks,
    timedReminders,
    anchoredHabits,
    nowMinutes,
  ]);

  // Compatibilidad con consumidores previos
  const reminderDateKeys = reminderDates;
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
    return [...blockItems, ...reminderItems].sort((a, b) =>
      a.sortTime.localeCompare(b.sortTime)
    );
  }, [blocks, timedReminders]);

  // --- CRUD Bloques / Eventos ---
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

  const updateWorkBlock = useCallback(
    (blockId: string, patch: UpdateWorkBlockInput) => {
      const existing = localStore.getWorkBlockById(blockId);
      if (!existing) return;

      const nextIsAllDay =
        patch.isAllDay !== undefined ? patch.isAllDay : Boolean(existing.isAllDay);
      const nextDateKey = patch.dateKey ?? existing.dateKey;
      const nextStartTime = nextIsAllDay
        ? '00:00'
        : patch.startTime ?? existing.startTime;
      const nextEndTime = nextIsAllDay
        ? '23:59'
        : patch.endTime ?? existing.endTime;
      const nextAlert =
        nextIsAllDay
          ? null
          : patch.alertMinutesBefore !== undefined
            ? patch.alertMinutesBefore
            : existing.alertMinutesBefore;
      const nextTitle =
        patch.title !== undefined
          ? patch.title.trim() || existing.title
          : existing.title;
      const nextLocation =
        patch.locationOrLink !== undefined
          ? patch.locationOrLink?.trim() || null
          : existing.locationOrLink;

      const scheduleChanged =
        nextDateKey !== existing.dateKey ||
        nextStartTime !== existing.startTime ||
        nextIsAllDay !== Boolean(existing.isAllDay) ||
        nextAlert !== existing.alertMinutesBefore ||
        nextTitle !== existing.title;

      if (scheduleChanged && existing.notificationId) {
        void cancelWorkBlockNotification(existing.notificationId);
      }

      const now = nextMonotonicTimestamp(existing.updatedAt);
      localStore.updateWorkBlock(blockId, {
        title: nextTitle,
        blockType: patch.blockType ?? existing.blockType,
        dateKey: nextDateKey,
        startTime: nextStartTime,
        endTime: nextEndTime,
        isAllDay: nextIsAllDay,
        alertMinutesBefore: nextAlert,
        notificationId: scheduleChanged ? null : existing.notificationId,
        color: patch.color !== undefined ? patch.color : existing.color,
        locationOrLink: nextLocation,
        isDirty: true,
        updatedAt: now,
      });

      const updated = localStore.getWorkBlockById(blockId);
      notifyDatabaseChanged();
      triggerBackgroundSync();

      if (scheduleChanged && updated) {
        scheduleWorkBlockAlertAsync(updated);
      }
    },
    []
  );

  const removeWorkBlock = useCallback((blockId: string) => {
    const existing = localStore.getWorkBlockById(blockId);
    if (existing?.notificationId) {
      void cancelWorkBlockNotification(existing.notificationId);
    }
    const now = nextMonotonicTimestamp(existing?.updatedAt);
    localStore.updateWorkBlock(blockId, {
      deletedAt: now,
      isDirty: true,
      updatedAt: now,
    });
    notifyDatabaseChanged();
    triggerBackgroundSync();
  }, []);

  // --- Recordatorios y Tareas ---
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

  const rescheduleReminderToSlot = useCallback(
    (taskId: string, dateKey: string, startMinutes: number) => {
      const existing = localStore.getTaskById(taskId);
      if (!existing) return;

      const clock = minutesToTime(startMinutes);
      const reminderAtMs = dateKeyAndTimeToEpochMs(dateKey, clock);
      const now = nextMonotonicTimestamp(existing.updatedAt);

      if (existing.notificationId) {
        void cancelTaskReminderNotification(existing.notificationId);
      }

      localStore.updateTask(taskId, {
        dueDate: dateKey,
        reminderAt: reminderAtMs,
        notified: false,
        notificationId: null,
        isCompleted: false,
        completedAt: null,
        isDirty: true,
        updatedAt: now,
      });

      notifyDatabaseChanged();
      triggerBackgroundSync();

      if (reminderAtMs > Date.now()) {
        void scheduleTaskReminderNotification({
          taskId,
          title: existing.title,
          notes: existing.notes,
          reminderAtMs,
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

  const scheduleUnscheduledTaskToSlot = useCallback(
    (
      taskId: string,
      dateKey: string,
      startMinutes: number,
      durationMinutes = 60
    ): WorkBlockRecord | null => {
      const task = localStore.getTaskById(taskId);
      if (!task) return null;

      const startTime = minutesToTime(startMinutes);
      const endTime = minutesToTime(
        Math.min(23 * 60 + 59, startMinutes + Math.max(15, durationMinutes))
      );
      const reminderAtMs = dateKeyAndTimeToEpochMs(dateKey, startTime);
      const now = nextMonotonicTimestamp(task.updatedAt);

      if (task.notificationId) {
        void cancelTaskReminderNotification(task.notificationId);
      }

      localStore.updateTask(taskId, {
        dueDate: dateKey,
        reminderAt: reminderAtMs,
        notified: false,
        notificationId: null,
        isDirty: true,
        updatedAt: now,
      });

      const block = insertWorkBlockOfflineFirst({
        title: task.title,
        blockType: 'personal',
        dateKey,
        startTime,
        endTime,
        alertMinutesBefore: 0,
        linkedTaskId: taskId,
        locationOrLink: task.notes || undefined,
        userId,
      });

      triggerCalendarHaptic('success');
      return block;
    },
    [userId]
  );

  const snoozeReminder = useCallback(
    (taskId: string, preset: SnoozePreset) => {
      return snoozeReminderOfflineFirst(taskId, preset);
    },
    []
  );

  // --- Hábitos anclados en el calendario ---
  const toggleCalendarHabit = useCallback(
    (habitId: string, targetDateKey = selectedDateKey) => {
      const habit = localStore.getHabitById(habitId);
      if (!habit) return;

      const logId = `${habitId}_${targetDateKey}`;
      const existingLog = localStore.getHabitLogById(logId);
      const now = nextMonotonicTimestamp(
        Math.max(habit.updatedAt, existingLog?.updatedAt ?? 0)
      );
      const currentlyCompleted = Boolean(
        existingLog &&
          !existingLog.deletedAt &&
          (existingLog.isCompleted || existingLog.status === 'completed')
      );
      const willComplete = !currentlyCompleted;

      localStore.upsertHabitLog({
        id: logId,
        habitId,
        userId: habit.userId || userId || localStore.getActiveUserId(),
        dateKey: targetDateKey,
        completedCount: willComplete ? Math.max(1, habit.targetPerDay) : 0,
        isCompleted: willComplete,
        status: willComplete ? 'completed' : 'partial',
        isDirty: true,
        deletedAt: willComplete ? null : now,
        updatedAt: now,
      });

      const allLogsForHabit = localStore
        .getAllHabitLogs()
        .filter((l) => l.habitId === habitId);
      const { currentStreak, bestStreak } = computeHabitStreakStats(
        habit,
        allLogsForHabit,
        todayKey
      );
      if (habit.streak !== currentStreak || habit.bestStreak !== bestStreak) {
        localStore.updateHabit(habitId, {
          streak: currentStreak,
          bestStreak,
          isDirty: true,
          updatedAt: nextMonotonicTimestamp(now),
        });
      }

      triggerCalendarHaptic(willComplete ? 'success' : 'light');
      notifyDatabaseChanged();
      triggerBackgroundSync();
    },
    [selectedDateKey, todayKey, userId]
  );

  // --- Plantillas de Turnos de Trabajo (1-Tap Shift Painter) ---
  const seedDefaultShiftTemplatesIfEmpty = useCallback(() => {
    if (localStore.getShiftTemplates().length > 0) return;
    let ts = nextMonotonicTimestamp();
    DEFAULT_SHIFT_PRESETS.forEach((preset, idx) => {
      ts = nextMonotonicTimestamp(ts);
      const tpl: ShiftTemplateRecord = {
        id: createLocalId(),
        userId: userId || localStore.getActiveUserId(),
        name: preset.name,
        startTime: preset.startTime,
        endTime: preset.endTime,
        color: preset.color,
        alertMinutesBefore: preset.alertMinutesBefore,
        locationOrLink: preset.locationOrLink,
        sortOrder: idx,
        isDirty: true,
        deletedAt: null,
        createdAt: ts,
        updatedAt: ts,
      };
      localStore.upsertShiftTemplate(tpl);
    });
    notifyDatabaseChanged();
    triggerBackgroundSync();
  }, [userId]);

  const createShiftTemplate = useCallback(
    (input: CreateShiftTemplateInput): ShiftTemplateRecord => {
      const existingCount = localStore.getShiftTemplates().length;
      const now = nextMonotonicTimestamp();
      const tpl: ShiftTemplateRecord = {
        id: createLocalId(),
        userId: userId || localStore.getActiveUserId(),
        name: input.name.trim(),
        startTime: input.startTime,
        endTime: input.endTime,
        color: input.color || CALENDAR_COLORS.shiftPurple,
        alertMinutesBefore: input.alertMinutesBefore ?? null,
        locationOrLink: input.locationOrLink?.trim() || null,
        sortOrder: existingCount,
        isDirty: true,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      localStore.upsertShiftTemplate(tpl);
      notifyDatabaseChanged();
      triggerBackgroundSync();
      return tpl;
    },
    [userId]
  );

  const deleteShiftTemplate = useCallback((templateId: string) => {
    const existing = localStore.getShiftTemplateById(templateId);
    if (!existing) return;
    const now = nextMonotonicTimestamp(existing.updatedAt);
    localStore.updateShiftTemplate(templateId, {
      deletedAt: now,
      isDirty: true,
      updatedAt: now,
    });
    notifyDatabaseChanged();
    triggerBackgroundSync();
  }, []);

  const updateShiftTemplate = useCallback(
    (
      templateId: string,
      patch: Partial<CreateShiftTemplateInput>,
      alsoUpdateExistingBlocks = false
    ) => {
      const existing = localStore.getShiftTemplateById(templateId);
      if (!existing) return;
      const now = nextMonotonicTimestamp(existing.updatedAt);
      const nextName =
        patch.name !== undefined ? patch.name.trim() || existing.name : existing.name;
      const nextStart = patch.startTime ?? existing.startTime;
      const nextEnd = patch.endTime ?? existing.endTime;
      const nextColor = patch.color ?? existing.color;
      const nextAlert =
        patch.alertMinutesBefore !== undefined
          ? patch.alertMinutesBefore
          : existing.alertMinutesBefore;
      const nextLoc =
        patch.locationOrLink !== undefined
          ? patch.locationOrLink?.trim() || null
          : existing.locationOrLink;

      localStore.updateShiftTemplate(templateId, {
        name: nextName,
        startTime: nextStart,
        endTime: nextEnd,
        color: nextColor,
        alertMinutesBefore: nextAlert,
        locationOrLink: nextLoc,
        isDirty: true,
        updatedAt: now,
      });

      if (alsoUpdateExistingBlocks) {
        let blockTs = now;
        for (const blk of localStore.getAllWorkBlocks()) {
          if (
            !blk.deletedAt &&
            blk.blockType === 'work_shift' &&
            blk.title === existing.name
          ) {
            blockTs = nextMonotonicTimestamp(Math.max(blockTs, blk.updatedAt));
            localStore.updateWorkBlock(blk.id, {
              title: nextName,
              startTime: nextStart,
              endTime: nextEnd,
              color: nextColor,
              alertMinutesBefore: nextAlert,
              locationOrLink: nextLoc,
              isDirty: true,
              updatedAt: blockTs,
            });
          }
        }
      }

      notifyDatabaseChanged();
      triggerBackgroundSync();
    },
    []
  );

  const applyRotation6x4Schedule = useCallback(
    (
      config: Rotation6x4Config
    ): { createdShifts: number; createdRestDays: number; clearedCount: number } => {
      const startKey = config.startDateKey;
      const horizon = Math.max(1, Math.min(730, Math.round(config.horizonDays || 365)));
      const endKey = shiftDateKeyLocal(startKey, horizon - 1);
      const resolvedUserId = userId || localStore.getActiveUserId();
      let ts = nextMonotonicTimestamp();
      let clearedCount = 0;

      // 1. Limpiar turnos y descansos 6x4 anteriores en [startKey, endKey] sin afectar otros eventos
      for (const blk of localStore.getAllWorkBlocks()) {
        const isManaged6x4Block =
          blk.blockType === 'work_shift' ||
          (blk.blockType === 'break' && blk.locationOrLink === 'Descanso 6×4');
        if (
          !blk.deletedAt &&
          isManaged6x4Block &&
          blk.dateKey >= startKey &&
          blk.dateKey <= endKey
        ) {
          if (blk.notificationId) {
            void cancelWorkBlockNotification(blk.notificationId);
          }
          ts = nextMonotonicTimestamp(Math.max(ts, blk.updatedAt));
          localStore.updateWorkBlock(blk.id, {
            deletedAt: ts,
            isDirty: true,
            updatedAt: ts,
          });
          clearedCount += 1;
        }
      }

      // 2. Generar rotación 6x4 (2 Mañanas, 2 Tardes, 2 Noches + 4 Días Libres)
      let createdShifts = 0;
      let createdRestDays = 0;
      const blocksForAlerts: WorkBlockRecord[] = [];

      for (let i = 0; i < horizon; i += 1) {
        const cyclePos = (i + config.cycleStartDayIndex) % 10;
        const dateKey = shiftDateKeyLocal(startKey, i);
        ts = nextMonotonicTimestamp(ts);

        if (cyclePos < 6) {
          const slot =
            cyclePos < 2
              ? config.morning
              : cyclePos < 4
                ? config.afternoon
                : config.night;

          const record: WorkBlockRecord = {
            id: createLocalId(),
            userId: resolvedUserId,
            title: slot.title.trim() || 'Turno',
            blockType: 'work_shift',
            dateKey,
            startTime: slot.startTime,
            endTime: slot.endTime,
            isAllDay: false,
            alertMinutesBefore: config.alertMinutesBefore ?? null,
            notificationId: null,
            color: slot.color,
            linkedTaskId: null,
            locationOrLink: 'Rotación 6×4',
            isRecurring: false,
            recurrenceDays: null,
            isDirty: true,
            deletedAt: null,
            createdAt: ts,
            updatedAt: ts,
          };
          localStore.upsertWorkBlock(record);
          createdShifts += 1;

          if (i < 14 && config.alertMinutesBefore !== null) {
            blocksForAlerts.push(record);
          }
        } else if (config.rest.enabled) {
          const restDayIndex = cyclePos - 5; // 1..4
          const restRecord: WorkBlockRecord = {
            id: createLocalId(),
            userId: resolvedUserId,
            title: `${config.rest.title.trim() || 'Día Libre'} (${restDayIndex}/4)`,
            blockType: 'break',
            dateKey,
            startTime: '00:00',
            endTime: '23:59',
            isAllDay: true,
            alertMinutesBefore: null,
            notificationId: null,
            color: config.rest.color || CALENDAR_COLORS.habitEmerald,
            linkedTaskId: null,
            locationOrLink: 'Descanso 6×4',
            isRecurring: false,
            recurrenceDays: null,
            isDirty: true,
            deletedAt: null,
            createdAt: ts,
            updatedAt: ts,
          };
          localStore.upsertWorkBlock(restRecord);
          createdRestDays += 1;
        }
      }

      triggerCalendarHaptic('success');
      notifyDatabaseChanged();
      triggerBackgroundSync();

      for (const blk of blocksForAlerts) {
        scheduleWorkBlockAlertAsync(blk);
      }

      return { createdShifts, createdRestDays, clearedCount };
    },
    [userId]
  );

  const clearFutureShifts = useCallback(
    (startDateKey: string, horizonDays = 365): number => {
      const horizon = Math.max(1, Math.min(730, Math.round(horizonDays || 365)));
      const endKey = shiftDateKeyLocal(startDateKey, horizon - 1);
      let ts = nextMonotonicTimestamp();
      let cleared = 0;

      for (const blk of localStore.getAllWorkBlocks()) {
        const isManaged =
          blk.blockType === 'work_shift' ||
          (blk.blockType === 'break' && blk.locationOrLink === 'Descanso 6×4');
        if (
          !blk.deletedAt &&
          isManaged &&
          blk.dateKey >= startDateKey &&
          blk.dateKey <= endKey
        ) {
          if (blk.notificationId) {
            void cancelWorkBlockNotification(blk.notificationId);
          }
          ts = nextMonotonicTimestamp(Math.max(ts, blk.updatedAt));
          localStore.updateWorkBlock(blk.id, {
            deletedAt: ts,
            isDirty: true,
            updatedAt: ts,
          });
          cleared += 1;
        }
      }

      if (cleared > 0) {
        triggerCalendarHaptic('light');
        notifyDatabaseChanged();
        triggerBackgroundSync();
      }
      return cleared;
    },
    []
  );

  const paintShiftOnDate = useCallback(
    (templateIdOrErase: string, dateKey: string) => {
      const existingShifts = localStore
        .getAllWorkBlocks()
        .filter((b) => b.dateKey === dateKey && b.blockType === 'work_shift');

      for (const shift of existingShifts) {
        if (shift.notificationId) {
          void cancelWorkBlockNotification(shift.notificationId);
        }
        const delTs = nextMonotonicTimestamp(shift.updatedAt);
        localStore.updateWorkBlock(shift.id, {
          deletedAt: delTs,
          isDirty: true,
          updatedAt: delTs,
        });
      }

      if (templateIdOrErase === 'erase') {
        triggerCalendarHaptic('light');
        notifyDatabaseChanged();
        triggerBackgroundSync();
        return;
      }

      const tpl = localStore.getShiftTemplateById(templateIdOrErase);
      if (!tpl) {
        notifyDatabaseChanged();
        triggerBackgroundSync();
        return;
      }

      triggerCalendarHaptic('medium');
      insertWorkBlockOfflineFirst({
        title: tpl.name,
        blockType: 'work_shift',
        dateKey,
        startTime: tpl.startTime,
        endTime: tpl.endTime,
        color: tpl.color,
        alertMinutesBefore:
          tpl.alertMinutesBefore === 0 ||
          tpl.alertMinutesBefore === 15 ||
          tpl.alertMinutesBefore === 60
            ? tpl.alertMinutesBefore
            : null,
        locationOrLink: tpl.locationOrLink || 'Turno programado',
        userId,
      });
    },
    [userId]
  );

  const paintShiftOnWeekdays = useCallback(
    (templateIdOrErase: string, weekDateKeys: string[]) => {
      // Lunes a Viernes (primeros 5 elementos de la semana L-D)
      const weekdays = weekDateKeys.slice(0, 5);
      for (const dk of weekdays) {
        paintShiftOnDate(templateIdOrErase, dk);
      }
      triggerCalendarHaptic('success');
    },
    [paintShiftOnDate]
  );

  const getShiftBlockForDate = useCallback(
    (dateKey: string): WorkBlockRecord | null => {
      return (
        allWorkBlocks.find(
          (b) =>
            !b.deletedAt && b.dateKey === dateKey && b.blockType === 'work_shift'
        ) ?? null
      );
    },
    [allWorkBlocks]
  );

  const bringOverdueReminderToNow = useCallback(
    (taskId: string) => {
      const targetMin = snapMinutes(nowMinutes, 15);
      rescheduleReminderToSlot(taskId, todayKey, targetMin);
      triggerCalendarHaptic('medium');
    },
    [nowMinutes, rescheduleReminderToSlot, todayKey]
  );

  return {
    todayKey,
    nowDate,
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
    timelineItems,
    reminderDateKeys,
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
  };
}
