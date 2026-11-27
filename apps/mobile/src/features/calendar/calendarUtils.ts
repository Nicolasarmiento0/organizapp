import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import type {
  WorkBlockAlertMinutes,
  WorkBlockRecord,
  WorkBlockType,
} from '@organiza/shared/schema';
import { getTodayDateKey } from '../../db/client';

export const CALENDAR_COLORS = {
  coral: '#FA6B6B',
  coralSoft: 'rgba(250, 107, 107, 0.14)',
  coralBorder: 'rgba(250, 107, 107, 0.34)',
  shiftPurple: '#7C3AED',
  shiftPurpleSoft: 'rgba(124, 58, 237, 0.14)',
  shiftPurpleBorder: 'rgba(124, 58, 237, 0.34)',
  habitEmerald: '#059669',
  habitEmeraldSoft: 'rgba(5, 150, 105, 0.14)',
  habitEmeraldBorder: 'rgba(5, 150, 105, 0.34)',
  reminderCoral: '#FA6B6B',
  reminderCoralSoft: 'rgba(250, 107, 107, 0.14)',
  reminderCoralBorder: 'rgba(250, 107, 107, 0.32)',
  eventDotGray: '#8E95A3',
} as const;

export const WEEKDAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

export const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

export const MONTH_SHORT_ES = [
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
] as const;

export const WEEKDAY_NAMES_ES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

export const ALERT_OPTIONS: ReadonlyArray<{
  value: WorkBlockAlertMinutes | null;
  label: string;
  shortLabel: string;
}> = [
  { value: null, label: 'Sin alerta', shortLabel: 'Sin' },
  { value: 0, label: 'A la hora del evento', shortLabel: 'A la hora' },
  { value: 15, label: '15 min antes', shortLabel: '15 min' },
  { value: 60, label: '1 hora antes', shortLabel: '1 hora' },
];

export const BLOCK_TYPE_META: Record<
  WorkBlockType,
  { label: string; color: string }
> = {
  personal: { label: 'EVENTO', color: CALENDAR_COLORS.coral },
  deep_work: { label: 'DEEP WORK', color: CALENDAR_COLORS.coral },
  meeting: { label: 'REUNIÓN', color: '#F59E0B' },
  work_shift: { label: 'TURNO LABORAL', color: CALENDAR_COLORS.shiftPurple },
  break: { label: 'DÍA LIBRE', color: CALENDAR_COLORS.habitEmerald },
};

export const SHIFT_COLOR_SWATCHES = [
  '#FA6B6B',
  '#7C3AED',
  '#059669',
  '#F59E0B',
  '#EC4899',
  '#14B8A6',
  '#E11D48',
  '#8B5CF6',
  '#EA580C',
  '#64748B',
] as const;

export function normalizeHexColor(raw: string): string | null {
  const clean = raw.trim();
  if (!clean) return null;
  const withHash = clean.startsWith('#') ? clean : `#${clean}`;
  if (/^#[0-9A-Fa-f]{6}$/.test(withHash)) {
    return withHash.toUpperCase();
  }
  return null;
}

export const WEEKDAY_SHORT_ES = [
  'Dom',
  'Lun',
  'Mar',
  'Mié',
  'Jue',
  'Vie',
  'Sáb',
] as const;

export interface ScrollRibbonDay {
  dateKey: string;
  dayShort: string;
  dayNum: string;
  isToday: boolean;
}

/**
 * Genera 63 días (9 semanas completas alineadas a Lunes: 4 semanas atrás + semana actual + 4 adelante)
 * para el ScrollView horizontal centrado en 7 días.
 */
export function buildScrollableRibbonDays(
  anchorDateKey: string,
  todayKey = getTodayDateKey()
): ScrollRibbonDay[] {
  const anchor = dateKeyToLocalDate(anchorDateKey);
  const dow = anchor.getDay();
  const mondayOffset = (dow + 6) % 7;
  const anchorMonday = new Date(anchor);
  anchorMonday.setDate(anchor.getDate() - mondayOffset);

  const start = new Date(anchorMonday);
  start.setDate(anchorMonday.getDate() - 28);

  const days: ScrollRibbonDay[] = [];
  for (let i = 0; i < 63; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateKey = getTodayDateKey(d);
    days.push({
      dateKey,
      dayShort: WEEKDAY_SHORT_ES[d.getDay()] ?? 'Día',
      dayNum: String(d.getDate()).padStart(2, '0'),
      isToday: dateKey === todayKey,
    });
  }
  return days;
}

export interface Rotation6x4SlotConfig {
  title: string;
  startTime: string;
  endTime: string;
  color: string;
}

export interface Rotation6x4RestConfig {
  enabled: boolean;
  title: string;
  color: string;
}

export interface Rotation6x4Config {
  startDateKey: string;
  cycleStartDayIndex: number; // 0..9
  horizonDays: number; // Cualquier rango: 30, 90, 180, 365 o personalizado (1..730)
  alertMinutesBefore: WorkBlockAlertMinutes | null;
  morning: Rotation6x4SlotConfig;
  afternoon: Rotation6x4SlotConfig;
  night: Rotation6x4SlotConfig;
  rest: Rotation6x4RestConfig;
}

export const ROTATION_6X4_CYCLE_STEPS: ReadonlyArray<{
  index: number;
  code: string;
  label: string;
  slotKey: 'morning' | 'afternoon' | 'night' | 'rest';
}> = [
  { index: 0, code: 'M1', label: 'Mañana 1', slotKey: 'morning' },
  { index: 1, code: 'M2', label: 'Mañana 2', slotKey: 'morning' },
  { index: 2, code: 'T1', label: 'Tarde 1', slotKey: 'afternoon' },
  { index: 3, code: 'T2', label: 'Tarde 2', slotKey: 'afternoon' },
  { index: 4, code: 'N1', label: 'Noche 1', slotKey: 'night' },
  { index: 5, code: 'N2', label: 'Noche 2', slotKey: 'night' },
  { index: 6, code: 'L1', label: 'Libre 1', slotKey: 'rest' },
  { index: 7, code: 'L2', label: 'Libre 2', slotKey: 'rest' },
  { index: 8, code: 'L3', label: 'Libre 3', slotKey: 'rest' },
  { index: 9, code: 'L4', label: 'Libre 4', slotKey: 'rest' },
];

export const DEFAULT_ROTATION_6X4_CONFIG = (
  startDateKey: string
): Rotation6x4Config => ({
  startDateKey,
  cycleStartDayIndex: 0,
  horizonDays: 365,
  alertMinutesBefore: 60,
  morning: {
    title: 'Turno Mañana',
    startTime: '06:00',
    endTime: '14:00',
    color: '#F59E0B',
  },
  afternoon: {
    title: 'Turno Tarde',
    startTime: '14:00',
    endTime: '22:00',
    color: '#FA6B6B',
  },
  night: {
    title: 'Turno Noche',
    startTime: '22:00',
    endTime: '06:00',
    color: '#7C3AED',
  },
  rest: {
    enabled: true,
    title: 'Día Libre',
    color: '#059669',
  },
});

export const DEFAULT_SHIFT_PRESETS: ReadonlyArray<{
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  alertMinutesBefore: WorkBlockAlertMinutes | null;
  locationOrLink: string;
}> = [
  {
    name: 'Turno Mañana',
    startTime: '06:00',
    endTime: '14:00',
    color: '#F59E0B',
    alertMinutesBefore: 60,
    locationOrLink: 'Turno matutino',
  },
  {
    name: 'Turno Tarde',
    startTime: '14:00',
    endTime: '22:00',
    color: '#FA6B6B',
    alertMinutesBefore: 60,
    locationOrLink: 'Turno vespertino',
  },
  {
    name: 'Turno Noche',
    startTime: '22:00',
    endTime: '06:00',
    color: '#7C3AED',
    alertMinutesBefore: 60,
    locationOrLink: 'Turno nocturno',
  },
];

export function triggerCalendarHaptic(
  kind: 'selection' | 'light' | 'medium' | 'success'
): void {
  if (Platform.OS === 'web') return;
  try {
    if (kind === 'selection') {
      void Haptics.selectionAsync().catch(() => {});
    } else if (kind === 'light') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } else if (kind === 'medium') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
    }
  } catch {
    // Ignorar si el dispositivo no soporta hápticos
  }
}

export function parseTimeToMinutes(hhmm?: string | null): number {
  if (!hhmm) return 0;
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.max(0, Math.min(24 * 60, h * 60 + m));
}

export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const hh = String(Math.floor(clamped / 60)).padStart(2, '0');
  const mm = String(clamped % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function snapMinutes(mins: number, step = 15): number {
  return Math.round(mins / step) * step;
}

export function clampMinutes(mins: number, min = 0, max = 23 * 60 + 45): number {
  return Math.max(min, Math.min(max, mins));
}

export function formatDurationShort(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function dateKeyToLocalDate(dateKey: string): Date {
  const [yStr, mStr, dStr] = dateKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return new Date();
  }
  return new Date(y, m - 1, d);
}

export function dateKeyAndTimeToEpochMs(dateKey: string, hhmm: string): number {
  const dt = dateKeyToLocalDate(dateKey);
  const totalMins = parseTimeToMinutes(hhmm);
  dt.setHours(Math.floor(totalMins / 60), totalMins % 60, 0, 0);
  return dt.getTime();
}

export function shiftDateKeyLocal(dateKey: string, deltaDays: number): string {
  const dt = dateKeyToLocalDate(dateKey);
  dt.setDate(dt.getDate() + deltaDays);
  return getTodayDateKey(dt);
}

export function diffDaysInclusive(startKey: string, endKey: string): number {
  const [sy, sm, sd] = startKey.split('-').map(Number);
  const [ey, em, ed] = endKey.split('-').map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return 1;
  const startUtc = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);
  return Math.max(1, Math.round((endUtc - startUtc) / 86_400_000) + 1);
}

export function diffDaysSigned(targetKey: string, baseKey: string): number {
  const [ty, tm, td] = targetKey.split('-').map(Number);
  const [by, bm, bd] = baseKey.split('-').map(Number);
  if (!ty || !tm || !td || !by || !bm || !bd) return 0;
  const targetUtc = Date.UTC(ty, tm - 1, td);
  const baseUtc = Date.UTC(by, bm - 1, bd);
  return Math.round((targetUtc - baseUtc) / 86_400_000);
}

export function formatShortDateEs(dateKey: string): string {
  const dt = dateKeyToLocalDate(dateKey);
  const day = dt.getDate();
  const mShort = MONTH_SHORT_ES[dt.getMonth()] ?? '';
  return `${day} ${mShort}`;
}

export interface RestPeriodWindow {
  startDateKey: string;
  endDateKey: string;
  daysCount: number;
  daysUntilStart: number;
  rangeLabel: string;
  color: string;
}

function buildRestRangeLabel(startDateKey: string, endDateKey: string): string {
  if (startDateKey === endDateKey) return formatShortDateEs(startDateKey);
  return `${formatShortDateEs(startDateKey)} – ${formatShortDateEs(endDateKey)}`;
}

/**
 * Calcula los próximos bloques de descanso a partir de la configuración 6x4 (vista previa).
 */
export function computeRestPeriodsFromRotationConfig(
  config: Rotation6x4Config,
  todayKey = getTodayDateKey()
): RestPeriodWindow[] {
  const horizon = Math.max(1, Math.min(730, Math.round(config.horizonDays || 365)));
  const windows: RestPeriodWindow[] = [];
  let currentStart: string | null = null;
  let currentEnd: string | null = null;
  let currentCount = 0;

  const flush = () => {
    if (currentStart && currentEnd && currentCount > 0) {
      if (currentEnd >= todayKey) {
        windows.push({
          startDateKey: currentStart,
          endDateKey: currentEnd,
          daysCount: currentCount,
          daysUntilStart: diffDaysSigned(currentStart, todayKey),
          rangeLabel: buildRestRangeLabel(currentStart, currentEnd),
          color: config.rest.color || CALENDAR_COLORS.habitEmerald,
        });
      }
    }
    currentStart = null;
    currentEnd = null;
    currentCount = 0;
  };

  for (let i = 0; i < horizon; i += 1) {
    const cyclePos = (i + config.cycleStartDayIndex) % 10;
    const isRest = cyclePos >= 6;
    const dateKey = shiftDateKeyLocal(config.startDateKey, i);

    if (isRest) {
      if (!currentStart) {
        currentStart = dateKey;
      }
      currentEnd = dateKey;
      currentCount += 1;
    } else {
      flush();
    }
  }
  flush();

  return windows;
}

/**
 * Agrupa los días libres guardados (`blockType === 'break'`) en bloques consecutivos de descanso.
 */
export function computeRestPeriodsFromBlocks(
  blocks: WorkBlockRecord[],
  todayKey = getTodayDateKey()
): RestPeriodWindow[] {
  const restByDate = new Map<string, string>();
  for (const blk of blocks) {
    if (
      !blk.deletedAt &&
      blk.blockType === 'break' &&
      blk.dateKey >= todayKey
    ) {
      restByDate.set(
        blk.dateKey,
        blk.color || CALENDAR_COLORS.habitEmerald
      );
    }
  }

  if (restByDate.size === 0) return [];

  const sortedDates = Array.from(restByDate.keys()).sort();
  const windows: RestPeriodWindow[] = [];
  let start = sortedDates[0]!;
  let end = start;
  let count = 1;
  let color = restByDate.get(start) ?? CALENDAR_COLORS.habitEmerald;

  for (let i = 1; i < sortedDates.length; i += 1) {
    const dateKey = sortedDates[i]!;
    if (diffDaysSigned(dateKey, end) === 1) {
      end = dateKey;
      count += 1;
    } else {
      windows.push({
        startDateKey: start,
        endDateKey: end,
        daysCount: count,
        daysUntilStart: diffDaysSigned(start, todayKey),
        rangeLabel: buildRestRangeLabel(start, end),
        color,
      });
      start = dateKey;
      end = dateKey;
      count = 1;
      color = restByDate.get(dateKey) ?? CALENDAR_COLORS.habitEmerald;
    }
  }

  windows.push({
    startDateKey: start,
    endDateKey: end,
    daysCount: count,
    daysUntilStart: diffDaysSigned(start, todayKey),
    rangeLabel: buildRestRangeLabel(start, end),
    color,
  });

  return windows;
}

export interface WeekStripDay {
  dateKey: string;
  letter: string;
  dayNum: string;
  isToday: boolean;
}

/**
 * Devuelve los 7 días (L M X J V S D) de la semana a la que pertenece `anchorDateKey`.
 */
export function getWeekDaysFromAnchor(
  anchorDateKey: string,
  todayKey = getTodayDateKey()
): WeekStripDay[] {
  const anchor = dateKeyToLocalDate(anchorDateKey);
  const dow = anchor.getDay();
  const mondayOffset = (dow + 6) % 7;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - mondayOffset);

  const result: WeekStripDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateKey = getTodayDateKey(d);
    result.push({
      dateKey,
      letter: WEEKDAY_LETTERS[i] ?? 'L',
      dayNum: String(d.getDate()),
      isToday: dateKey === todayKey,
    });
  }
  return result;
}

export interface MonthGridCell {
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
}

/**
 * Construye una cuadrícula completa de 42 celdas (6x7, Lunes a Domingo) para el mes.
 */
export function buildMonthMatrix(
  year: number,
  month: number,
  todayKey = getTodayDateKey()
): MonthGridCell[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);

  const cells: MonthGridCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const dateKey = getTodayDateKey(d);
    cells.push({
      dateKey,
      dayNumber: d.getDate(),
      inCurrentMonth: d.getMonth() === month && d.getFullYear() === year,
      isToday: dateKey === todayKey,
    });
  }
  return cells;
}

export function formatMonthYearEs(year: number, month: number): string {
  return `${MONTH_NAMES_ES[month] ?? 'Mes'} ${year}`;
}

export function formatDateHeadlineEs(dateKey: string, todayKey: string): string {
  const dt = dateKeyToLocalDate(dateKey);
  const weekday = WEEKDAY_NAMES_ES[dt.getDay()] ?? '';
  const day = dt.getDate();
  const monthShort = MONTH_SHORT_ES[dt.getMonth()] ?? '';
  if (dateKey === todayKey) return `Hoy · ${day} ${monthShort}`;
  if (dateKey === shiftDateKeyLocal(todayKey, 1)) return `Mañana · ${day} ${monthShort}`;
  if (dateKey === shiftDateKeyLocal(todayKey, -1)) return `Ayer · ${day} ${monthShort}`;
  return `${weekday} ${day} ${monthShort}`;
}

export function parseTimeInputSafe(raw: string, fallback = '09:00'): string {
  const clean = raw.trim();
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(clean);
  if (!match) return fallback;
  return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`;
}

export interface TimedIntervalLayoutInput {
  id: string;
  startMin: number;
  endMin: number;
}

export interface TimedIntervalLayoutResult {
  columnIndex: number;
  columnCount: number;
}

/**
 * Asigna columnas a bloques superpuestos para renderizarlos lado a lado sin taparse.
 */
export function layoutOverlappingIntervals<T extends TimedIntervalLayoutInput>(
  items: T[]
): Map<string, TimedIntervalLayoutResult> {
  const layout = new Map<string, TimedIntervalLayoutResult>();
  if (items.length === 0) return layout;

  const sorted = [...items].sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    return b.endMin - a.endMin;
  });

  let cluster: T[] = [];
  let clusterMaxEnd = -1;

  const flushCluster = (group: T[]) => {
    if (group.length === 0) return;
    const columnEndTimes: number[] = [];
    const assigned = new Map<string, number>();

    for (const item of group) {
      let col = columnEndTimes.findIndex((endMin) => endMin <= item.startMin);
      if (col === -1) {
        col = columnEndTimes.length;
        columnEndTimes.push(item.endMin);
      } else {
        columnEndTimes[col] = item.endMin;
      }
      assigned.set(item.id, col);
    }

    const totalCols = Math.max(1, columnEndTimes.length);
    for (const item of group) {
      layout.set(item.id, {
        columnIndex: assigned.get(item.id) ?? 0,
        columnCount: totalCols,
      });
    }
  };

  for (const item of sorted) {
    if (cluster.length === 0 || item.startMin < clusterMaxEnd) {
      cluster.push(item);
      clusterMaxEnd = Math.max(clusterMaxEnd, item.endMin);
    } else {
      flushCluster(cluster);
      cluster = [item];
      clusterMaxEnd = item.endMin;
    }
  }
  flushCluster(cluster);

  return layout;
}

/**
 * Encuentra el próximo hueco libre en la línea de tiempo para Time-Blocking en 1 toque.
 */
export function findNextFreeSlot(
  blocks: Array<{ startTime: string; endTime: string; isAllDay?: boolean }>,
  referenceMinutes: number,
  durationMins = 60
): { startMinutes: number; endMinutes: number } {
  const timed = blocks
    .filter((b) => !b.isAllDay)
    .map((b) => ({
      start: parseTimeToMinutes(b.startTime),
      end: Math.max(
        parseTimeToMinutes(b.startTime) + 15,
        parseTimeToMinutes(b.endTime)
      ),
    }))
    .sort((a, b) => a.start - b.start);

  let candidate = clampMinutes(snapMinutes(referenceMinutes, 15), 7 * 60, 22 * 60);

  for (let guard = 0; guard < 64; guard++) {
    const candidateEnd = candidate + durationMins;
    const conflict = timed.find(
      (b) => candidate < b.end && candidateEnd > b.start
    );
    if (!conflict) {
      return {
        startMinutes: candidate,
        endMinutes: Math.min(24 * 60, candidateEnd),
      };
    }
    candidate = snapMinutes(conflict.end, 15);
    if (candidate >= 23 * 60) {
      return {
        startMinutes: clampMinutes(snapMinutes(referenceMinutes, 15), 0, 23 * 60),
        endMinutes: Math.min(
          24 * 60,
          clampMinutes(snapMinutes(referenceMinutes, 15), 0, 23 * 60) +
            durationMins
        ),
      };
    }
  }

  return {
    startMinutes: candidate,
    endMinutes: Math.min(24 * 60, candidate + durationMins),
  };
}

export function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(250, 107, 107, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    return `rgba(250, 107, 107, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
