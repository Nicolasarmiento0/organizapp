import type { TaskPriority, TaskRecord } from '@organiza/shared/schema';
import { getTodayDateKey } from '../../db/client';

export type SmartListKey = 'today' | 'scheduled' | 'all' | 'flagged';
export type AllStatusFilter = 'all' | 'pending' | 'alerts' | 'completed';
export type PriorityFilter = 'all' | TaskPriority;
export type QuickDatePreset =
  | 'none'
  | '30m'
  | '1h'
  | 'today18'
  | 'tomorrow9'
  | 'custom';

export interface ScheduledGroup {
  id: string;
  title: string;
  subtitle: string;
  isOverdue: boolean;
  items: TaskRecord[];
}

export interface ReminderSmartCounts {
  today: number;
  overdue: number;
  scheduled: number;
  allPending: number;
  allTotal: number;
  flagged: number;
  alerts: number;
}

export function addDaysToDateKey(baseDateKey: string, deltaDays: number): string {
  const [y, m, d] = baseDateKey.split('-').map(Number);
  const dt = new Date(y || 2026, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + deltaDays);
  return getTodayDateKey(dt);
}

export function diffDateKeysInDays(targetKey: string, baseKey: string): number {
  const [ty, tm, td] = targetKey.split('-').map(Number);
  const [by, bm, bd] = baseKey.split('-').map(Number);
  const targetMs = Date.UTC(ty || 2026, (tm || 1) - 1, td || 1);
  const baseMs = Date.UTC(by || 2026, (bm || 1) - 1, bd || 1);
  return Math.round((targetMs - baseMs) / 86_400_000);
}

export function getTaskEffectiveDateKey(task: TaskRecord): string | null {
  if (task.reminderAt) {
    return getTodayDateKey(new Date(task.reminderAt));
  }
  return task.dueDate || null;
}

export function isTaskOverdue(
  task: TaskRecord,
  nowMs: number,
  todayKey: string
): boolean {
  if (task.isCompleted) return false;
  if (task.reminderAt !== null && task.reminderAt !== undefined) {
    return task.reminderAt < nowMs;
  }
  const effectiveDateKey = getTaskEffectiveDateKey(task);
  return Boolean(effectiveDateKey && effectiveDateKey < todayKey);
}

export function isTaskInTodaySmartList(
  task: TaskRecord,
  nowMs: number,
  todayKey: string
): boolean {
  if (task.isCompleted) return false;
  const effectiveDateKey = getTaskEffectiveDateKey(task);
  return effectiveDateKey === todayKey || isTaskOverdue(task, nowMs, todayKey);
}

export function isTaskInScheduledSmartList(task: TaskRecord): boolean {
  if (task.isCompleted) return false;
  return Boolean(task.reminderAt) || Boolean(task.dueDate);
}

export function isTaskInFlaggedSmartList(task: TaskRecord): boolean {
  if (task.isCompleted) return false;
  return Boolean(task.isFlagged) || task.priority === 3;
}

export function sortReminderTasks(items: TaskRecord[]): TaskRecord[] {
  return [...items].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1;
    }

    const aHasTime = Boolean(a.reminderAt);
    const bHasTime = Boolean(b.reminderAt);
    if (aHasTime && bHasTime && a.reminderAt !== b.reminderAt) {
      return (a.reminderAt ?? 0) - (b.reminderAt ?? 0);
    }
    if (aHasTime !== bHasTime) {
      return aHasTime ? -1 : 1;
    }

    const aDate = getTaskEffectiveDateKey(a);
    const bDate = getTaskEffectiveDateKey(b);
    if (aDate && bDate && aDate !== bDate) {
      return aDate.localeCompare(bDate);
    }
    if (Boolean(aDate) !== Boolean(bDate)) {
      return aDate ? -1 : 1;
    }

    if (Boolean(a.isFlagged) !== Boolean(b.isFlagged)) {
      return a.isFlagged ? -1 : 1;
    }
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return b.createdAt - a.createdAt;
  });
}

export function groupScheduledTasks(
  items: TaskRecord[],
  todayKey: string,
  nowMs: number
): ScheduledGroup[] {
  const tomorrowKey = addDaysToDateKey(todayKey, 1);

  const buckets: Record<
    'overdue' | 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'later',
    TaskRecord[]
  > = {
    overdue: [],
    today: [],
    tomorrow: [],
    this_week: [],
    next_week: [],
    later: [],
  };

  for (const item of sortReminderTasks(items)) {
    if (!isTaskInScheduledSmartList(item)) continue;
    const effectiveKey = getTaskEffectiveDateKey(item);
    if (isTaskOverdue(item, nowMs, todayKey)) {
      buckets.overdue.push(item);
      continue;
    }
    if (!effectiveKey || effectiveKey === todayKey) {
      buckets.today.push(item);
      continue;
    }
    if (effectiveKey === tomorrowKey) {
      buckets.tomorrow.push(item);
      continue;
    }
    const deltaDays = diffDateKeysInDays(effectiveKey, todayKey);
    if (deltaDays >= 2 && deltaDays <= 6) {
      buckets.this_week.push(item);
    } else if (deltaDays >= 7 && deltaDays <= 13) {
      buckets.next_week.push(item);
    } else {
      buckets.later.push(item);
    }
  }

  const definitions: Array<{
    id: keyof typeof buckets;
    title: string;
    subtitle: string;
    isOverdue: boolean;
  }> = [
    { id: 'overdue', title: 'Vencidos', subtitle: 'Requieren atención', isOverdue: true },
    { id: 'today', title: 'Hoy', subtitle: 'Vencen durante el día', isOverdue: false },
    { id: 'tomorrow', title: 'Mañana', subtitle: 'Próximo día', isOverdue: false },
    { id: 'this_week', title: 'Esta semana', subtitle: 'Próximos días', isOverdue: false },
    { id: 'next_week', title: 'Próxima semana', subtitle: '7 a 13 días', isOverdue: false },
    { id: 'later', title: 'Más adelante', subtitle: 'Horizonte futuro', isOverdue: false },
  ];

  return definitions
    .filter((def) => buckets[def.id].length > 0)
    .map((def) => ({
      id: def.id,
      title: def.title,
      subtitle: def.subtitle,
      isOverdue: def.isOverdue,
      items: buckets[def.id],
    }));
}

const MONTH_SHORT_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

function formatDateKeyShortEs(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return 'Hoy';
  if (dateKey === addDaysToDateKey(todayKey, 1)) return 'Mañana';
  if (dateKey === addDaysToDateKey(todayKey, -1)) return 'Ayer';

  const [, mStr, dStr] = dateKey.split('-');
  const monthIdx = Math.max(0, Math.min(11, Number(mStr) - 1));
  const dayNum = Number(dStr) || 1;
  return `${dayNum} ${MONTH_SHORT_ES[monthIdx] ?? ''}`.trim();
}

export function formatReminderClock(epochMs?: number | null): string | null {
  if (!epochMs) return null;
  try {
    const d = new Date(epochMs);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return null;
  }
}

export function formatReminderScheduleBadge(
  task: TaskRecord,
  todayKey: string,
  nowMs: number
): { label: string; hasTime: boolean; isOverdue: boolean; isToday: boolean } | null {
  const effectiveKey = getTaskEffectiveDateKey(task);
  const clock = formatReminderClock(task.reminderAt);
  if (!effectiveKey && !clock) return null;

  const dateLabel = effectiveKey ? formatDateKeyShortEs(effectiveKey, todayKey) : '';
  const label =
    dateLabel && clock ? `${dateLabel} · ${clock}` : dateLabel || clock || '';

  return {
    label,
    hasTime: Boolean(clock),
    isOverdue: isTaskOverdue(task, nowMs, todayKey),
    isToday: effectiveKey === todayKey,
  };
}

export function computeQuickPreset(
  preset: QuickDatePreset,
  nowDate: Date = new Date()
): { dueDate: string | null; reminderAt: number | null } {
  const baseMs = nowDate.getTime();
  if (preset === 'none') {
    return { dueDate: null, reminderAt: null };
  }
  if (preset === '30m') {
    const target = new Date(baseMs + 30 * 60_000);
    return { dueDate: getTodayDateKey(target), reminderAt: target.getTime() };
  }
  if (preset === '1h') {
    const target = new Date(baseMs + 60 * 60_000);
    return { dueDate: getTodayDateKey(target), reminderAt: target.getTime() };
  }
  if (preset === 'today18') {
    const target = new Date(nowDate);
    target.setHours(18, 0, 0, 0);
    if (target.getTime() <= baseMs + 60_000) {
      target.setDate(target.getDate() + 1);
    }
    return { dueDate: getTodayDateKey(target), reminderAt: target.getTime() };
  }
  if (preset === 'tomorrow9') {
    const target = new Date(nowDate);
    target.setDate(target.getDate() + 1);
    target.setHours(9, 0, 0, 0);
    return { dueDate: getTodayDateKey(target), reminderAt: target.getTime() };
  }
  return { dueDate: getTodayDateKey(nowDate), reminderAt: null };
}

export function parseCustomDateTime(
  dateStr: string,
  timeStr: string
): { dueDate: string | null; reminderAt: number | null; error?: string } {
  const cleanDate = dateStr.trim();
  const cleanTime = timeStr.trim();

  if (!cleanDate && !cleanTime) {
    return { dueDate: null, reminderAt: null };
  }

  const effectiveDateStr = cleanDate || getTodayDateKey();
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(effectiveDateStr);
  if (!dateMatch) {
    return {
      dueDate: null,
      reminderAt: null,
      error: 'Usa el formato de fecha AAAA-MM-DD (ej. 2026-11-27).',
    };
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const dateObj = new Date(year, month - 1, day);
  if (
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== month - 1 ||
    dateObj.getDate() !== day
  ) {
    return {
      dueDate: null,
      reminderAt: null,
      error: 'La fecha ingresada no es válida.',
    };
  }

  if (!cleanTime) {
    return { dueDate: effectiveDateStr, reminderAt: null };
  }

  const timeMatch = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(cleanTime);
  if (!timeMatch) {
    return {
      dueDate: null,
      reminderAt: null,
      error: 'Usa el formato de hora HH:mm (ej. 14:30).',
    };
  }

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  dateObj.setHours(hours, minutes, 0, 0);

  return {
    dueDate: effectiveDateStr,
    reminderAt: dateObj.getTime(),
  };
}

export function extractDateAndTimeInputs(task?: TaskRecord | null): {
  dateStr: string;
  timeStr: string;
} {
  if (!task) {
    return { dateStr: getTodayDateKey(), timeStr: '' };
  }
  if (task.reminderAt) {
    const d = new Date(task.reminderAt);
    return {
      dateStr: getTodayDateKey(d),
      timeStr: formatReminderClock(task.reminderAt) ?? '',
    };
  }
  return {
    dateStr: task.dueDate ?? '',
    timeStr: '',
  };
}

export type SnoozePreset = '1h' | 'this_evening' | 'tomorrow_9am';

export interface SnoozeTarget {
  dueDate: string;
  reminderAt: number;
  displayLabel: string;
}

export const SNOOZE_OPTIONS: ReadonlyArray<{
  key: SnoozePreset;
  title: string;
  shortLabel: string;
}> = [
  { key: '1h', title: 'En 1 hora', shortLabel: '+1h' },
  { key: 'this_evening', title: 'Esta tarde (18:00)', shortLabel: '18:00' },
  { key: 'tomorrow_9am', title: 'Mañana a las 09:00', shortLabel: 'Mañ 9h' },
];

export function computeSnoozeTarget(
  preset: SnoozePreset,
  nowDate: Date = new Date()
): SnoozeTarget {
  const baseMs = nowDate.getTime();
  const todayKey = getTodayDateKey(nowDate);

  if (preset === '1h') {
    const target = new Date(baseMs + 60 * 60_000);
    const dueDate = getTodayDateKey(target);
    const dayPrefix = dueDate === todayKey ? 'Hoy' : 'Mañana';
    const clock = formatReminderClock(target.getTime()) ?? '';
    return {
      dueDate,
      reminderAt: target.getTime(),
      displayLabel: `${dayPrefix} · ${clock}`,
    };
  }

  if (preset === 'this_evening') {
    const target = new Date(nowDate);
    target.setHours(18, 0, 0, 0);
    if (target.getTime() <= baseMs + 60_000) {
      target.setDate(target.getDate() + 1);
    }
    const dueDate = getTodayDateKey(target);
    const dayPrefix = dueDate === todayKey ? 'Hoy' : 'Mañana';
    return {
      dueDate,
      reminderAt: target.getTime(),
      displayLabel: `${dayPrefix} · 18:00`,
    };
  }

  const target = new Date(nowDate);
  target.setDate(target.getDate() + 1);
  target.setHours(9, 0, 0, 0);
  return {
    dueDate: getTodayDateKey(target),
    reminderAt: target.getTime(),
    displayLabel: 'Mañana · 09:00',
  };
}

export function getSnoozeOptionPreview(
  preset: SnoozePreset,
  nowDate: Date = new Date()
): string {
  return computeSnoozeTarget(preset, nowDate).displayLabel;
}

