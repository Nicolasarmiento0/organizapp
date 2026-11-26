import type { HabitLogRecord, HabitRecord } from '@organiza/shared/schema';

export type HeatmapRangeDays = 30 | 90 | 180 | 365;

export interface HabitStreakStats {
  currentStreak: number;
  bestStreak: number;
}

export interface RestShieldStats {
  available: number;
  max: number;
  usedLast30: number;
  nextShieldInCompletions: number;
}

export interface HeatmapCellData {
  dateKey: string;
  completedCount: number;
  scheduledCount: number;
  shieldCount: number;
  pausedCount: number;
  ratio: number;
  level: 0 | 1 | 2 | 3 | 4;
  hasShield: boolean;
  isAllPaused: boolean;
}

export interface HabitConsoleAnalytics {
  consistency30dPercent: number;
  weeklyDeltaPercent: number;
  perfectDays30d: number;
  bestHistoricalStreak: number;
  bestStreakHabitTitle: string;
  totalPoints: number;
}

export interface HabitWeeklyProgress {
  weekStartKey: string;
  weekEndKey: string;
  weekDateKeys: string[];
  completedThisWeek: number;
  completedDateKeys: string[];
  weeklyGoal: number | null;
  weekPoints: number;
  maxWeekPoints: number;
  goalMet: boolean;
  progressPercent: number;
}

export interface WeeklyScoreTotals {
  currentWeekScore: number;
  currentWeekMaxScore: number;
  totalAchievementScore: number;
  weeklyGoalsMetTotal: number;
}

/**
 * Desplaza una fecha `YYYY-MM-DD` en calendario local sin deriva por zona horaria.
 */
export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [yStr, mStr, dStr] = dateKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return dateKey;
  }
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Devuelve el día de la semana (`0 = Dom .. 6 = Sáb`) para un `dateKey` (`YYYY-MM-DD`).
 */
export function getDayOfWeekFromDateKey(dateKey: string): number {
  const [yStr, mStr, dStr] = dateKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return new Date().getDay();
  }
  return new Date(y, m - 1, d).getDay();
}

export function parseScheduledDays(raw?: string | null): number[] {
  if (!raw) return [0, 1, 2, 3, 4, 5, 6];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(
        (n): n is number =>
          typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 6
      );
      if (valid.length > 0) {
        return Array.from(new Set(valid)).sort((a, b) => a - b);
      }
    }
  } catch {
    // Fallback a todos los días si el JSON está corrupto
  }
  return [0, 1, 2, 3, 4, 5, 6];
}

export function isHabitScheduledOnDate(
  habit: Pick<HabitRecord, 'scheduledDays'>,
  dateKey: string
): boolean {
  const day = getDayOfWeekFromDateKey(dateKey);
  return parseScheduledDays(habit.scheduledDays).includes(day);
}

export function isHabitPausedOnDate(
  habit: Pick<HabitRecord, 'isPaused' | 'pausedUntil'>,
  dateKey: string
): boolean {
  if (!habit.isPaused) return false;
  if (!habit.pausedUntil) return true;
  return dateKey <= habit.pausedUntil;
}

function isCompletedLog(log?: HabitLogRecord): boolean {
  if (!log || log.deletedAt) return false;
  return log.status === 'completed' || log.isCompleted;
}

function isBridgeLog(log?: HabitLogRecord): boolean {
  if (!log || log.deletedAt) return false;
  return log.status === 'rest_shield' || log.status === 'paused';
}

function diffDaysBetweenKeys(startKey: string, endKey: string): number {
  const [sy, sm, sd] = startKey.split('-').map(Number);
  const [ey, em, ed] = endKey.split('-').map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return 365;
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  return Math.max(0, Math.round((endMs - startMs) / 86400000));
}

/**
 * Calcula la racha actual y la mejor racha histórica de un hábito respetando:
 * - Días no programados (turnos rotativos / L-V)
 * - Modo Pausa
 * - Escudo de Descanso (`rest_shield`)
 * - Período de gracia para el día de referencia (`offset === 0`)
 * Soporta historiales multianuales (hasta 10 años / 3650 días).
 */
export function computeHabitStreakStats(
  habit: HabitRecord,
  logsForHabit: HabitLogRecord[],
  referenceDateKey: string
): HabitStreakStats {
  const logByDate = new Map<string, HabitLogRecord>();
  let earliestDateKey: string | null = null;
  for (const log of logsForHabit) {
    if (!log.deletedAt && log.habitId === habit.id) {
      logByDate.set(log.dateKey, log);
      if (!earliestDateKey || log.dateKey < earliestDateKey) {
        earliestDateKey = log.dateKey;
      }
    }
  }

  const earliestDiff = earliestDateKey
    ? diffDaysBetweenKeys(earliestDateKey, referenceDateKey)
    : 365;
  const lookbackDays = Math.min(3650, Math.max(365, earliestDiff + 2));
  const scheduledDaysSet = new Set(parseScheduledDays(habit.scheduledDays));

  let currentStreak = 0;
  for (let offset = 0; offset < lookbackDays; offset++) {
    const dateKey = shiftDateKey(referenceDateKey, -offset);
    const log = logByDate.get(dateKey);
    const scheduled = scheduledDaysSet.has(getDayOfWeekFromDateKey(dateKey));
    const paused = isHabitPausedOnDate(habit, dateKey);

    if (isCompletedLog(log)) {
      currentStreak += 1;
      continue;
    }

    if (isBridgeLog(log) || paused || !scheduled) {
      continue;
    }

    // Día actual en curso (período de gracia hasta que termine el día)
    if (offset === 0) {
      continue;
    }

    break;
  }

  // Cálculo de mejor racha histórica en toda la ventana de historial
  let running = 0;
  let historicalBest = 0;
  for (let offset = lookbackDays - 1; offset >= 0; offset--) {
    const dateKey = shiftDateKey(referenceDateKey, -offset);
    const log = logByDate.get(dateKey);
    const scheduled = scheduledDaysSet.has(getDayOfWeekFromDateKey(dateKey));
    const paused = isHabitPausedOnDate(habit, dateKey);

    if (isCompletedLog(log)) {
      running += 1;
      if (running > historicalBest) {
        historicalBest = running;
      }
      continue;
    }

    if (isBridgeLog(log) || paused || !scheduled) {
      continue;
    }

    if (offset === 0) {
      continue;
    }

    running = 0;
  }

  const bestStreak = Math.max(habit.bestStreak ?? 0, historicalBest, currentStreak);
  return { currentStreak, bestStreak };
}

/**
 * Calcula los Escudos de Descanso disponibles (máx 3):
 * - Base de 2 escudos iniciales
 * - +1 escudo ganado cada 7 registros completados
 * - Menos los escudos usados en los últimos 30 días
 */
export function computeAvailableRestShields(
  allLogs: HabitLogRecord[],
  todayKey: string
): RestShieldStats {
  const activeLogs = allLogs.filter((l) => !l.deletedAt);
  const completedTotal = activeLogs.filter((l) => isCompletedLog(l)).length;
  const thirtyDaysAgo = shiftDateKey(todayKey, -30);

  const usedLast30 = activeLogs.filter(
    (l) =>
      l.status === 'rest_shield' &&
      l.dateKey >= thirtyDaysAgo &&
      l.dateKey <= todayKey
  ).length;

  const max = 3;
  const earned = 2 + Math.floor(completedTotal / 7);
  const available = Math.max(0, Math.min(max, earned - usedLast30));
  const nextShieldInCompletions = 7 - (completedTotal % 7);

  return {
    available,
    max,
    usedLast30,
    nextShieldInCompletions,
  };
}

/**
 * Construye las celdas de Heatmap de Consistencia para 30, 90, 180 o 365 días.
 */
export function buildHeatmapCells(
  habits: HabitRecord[],
  logs: HabitLogRecord[],
  days: HeatmapRangeDays,
  todayKey: string,
  filterHabitId?: string | null
): HeatmapCellData[] {
  const targetHabits = filterHabitId
    ? habits.filter((h) => h.id === filterHabitId && !h.deletedAt)
    : habits.filter((h) => !h.deletedAt && !h.isArchived);

  const scheduledSetByHabit = new Map<string, Set<number>>();
  for (const h of targetHabits) {
    scheduledSetByHabit.set(h.id, new Set(parseScheduledDays(h.scheduledDays)));
  }

  const logLookup = new Map<string, HabitLogRecord>();
  for (const log of logs) {
    if (!log.deletedAt) {
      logLookup.set(`${log.habitId}_${log.dateKey}`, log);
    }
  }

  const cells: HeatmapCellData[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dateKey = shiftDateKey(todayKey, -i);
    const dow = getDayOfWeekFromDateKey(dateKey);
    let scheduledCount = 0;
    let completedCount = 0;
    let shieldCount = 0;
    let pausedCount = 0;

    for (const habit of targetHabits) {
      const log = logLookup.get(`${habit.id}_${dateKey}`);
      const paused = isHabitPausedOnDate(habit, dateKey) || log?.status === 'paused';
      const scheduled = scheduledSetByHabit.get(habit.id)?.has(dow) ?? true;

      if (paused) {
        pausedCount += 1;
        continue;
      }

      if (log?.status === 'rest_shield') {
        shieldCount += 1;
        continue;
      }

      if (scheduled || isCompletedLog(log)) {
        scheduledCount += 1;
        if (isCompletedLog(log)) {
          completedCount += 1;
        }
      }
    }

    const ratio = scheduledCount > 0 ? completedCount / scheduledCount : 0;
    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (completedCount > 0) {
      if (ratio >= 1) level = 4;
      else if (ratio >= 0.67) level = 3;
      else if (ratio >= 0.34) level = 2;
      else level = 1;
    }

    cells.push({
      dateKey,
      completedCount,
      scheduledCount,
      shieldCount,
      pausedCount,
      ratio,
      level,
      hasShield: shieldCount > 0,
      isAllPaused:
        targetHabits.length > 0 &&
        pausedCount === targetHabits.length &&
        completedCount === 0,
    });
  }

  return cells;
}

function computeSliceConsistencyPercent(slice: HeatmapCellData[]): number {
  const scheduled = slice.reduce((sum, cell) => sum + cell.scheduledCount, 0);
  const completed = slice.reduce((sum, cell) => sum + cell.completedCount, 0);
  return scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;
}

/**
 * Calcula las métricas de la Consola Tesla de Hábitos (consistencia 30D,
 * variación semanal, días perfectos, mejor racha histórica y puntos totales).
 */
export function computeConsoleAnalytics(
  habits: HabitRecord[],
  allLogs: HabitLogRecord[],
  todayKey: string
): HabitConsoleAnalytics {
  const activeHabits = habits.filter((h) => !h.deletedAt && !h.isArchived);
  const cells30 = buildHeatmapCells(activeHabits, allLogs, 30, todayKey);

  const consistency30dPercent = computeSliceConsistencyPercent(cells30);
  const last7Percent = computeSliceConsistencyPercent(cells30.slice(23, 30));
  const prev7Percent = computeSliceConsistencyPercent(cells30.slice(16, 23));
  const weeklyDeltaPercent = last7Percent - prev7Percent;

  const perfectDays30d = cells30.filter(
    (c) => c.scheduledCount > 0 && c.completedCount >= c.scheduledCount
  ).length;

  let bestHistoricalStreak = 0;
  let bestStreakHabitTitle = activeHabits[0]?.title ?? 'Sin hábitos';
  let totalStreakDays = 0;

  for (const habit of activeHabits) {
    const habitLogs = allLogs.filter(
      (l) => !l.deletedAt && l.habitId === habit.id
    );
    const stats = computeHabitStreakStats(habit, habitLogs, todayKey);
    const current = Math.max(habit.streak ?? 0, stats.currentStreak);
    const best = Math.max(habit.bestStreak ?? 0, stats.bestStreak, current);
    totalStreakDays += current;
    if (best > bestHistoricalStreak) {
      bestHistoricalStreak = best;
      bestStreakHabitTitle = habit.title;
    }
  }

  const todayCompleted = cells30[cells30.length - 1]?.completedCount ?? 0;
  const totalPoints = totalStreakDays * 10 + todayCompleted * 25;

  return {
    consistency30dPercent,
    weeklyDeltaPercent,
    perfectDays30d,
    bestHistoricalStreak,
    bestStreakHabitTitle,
    totalPoints,
  };
}

/**
 * Devuelve los 7 `dateKey` (`YYYY-MM-DD`) de Lunes a Domingo de la semana
 * a la que pertenece `referenceDateKey`.
 */
export function getWeekDateKeys(referenceDateKey: string): string[] {
  const dow = getDayOfWeekFromDateKey(referenceDateKey);
  const mondayOffset = (dow + 6) % 7;
  const mondayKey = shiftDateKey(referenceDateKey, -mondayOffset);
  return Array.from({ length: 7 }, (_, idx) => shiftDateKey(mondayKey, idx));
}

/**
 * Puntaje escalonado semanal para objetivos opcionales:
 * - 0 logros -> 0 pts
 * - Meta completa (>= weeklyGoal) -> 100 pts
 * - Parcial -> curva sub-lineal (ej. para meta 3: 1/3 -> 20 pts, 2/3 -> 48 pts, 3/3 -> 100 pts)
 */
export function computeWeeklyGoalPoints(
  completedCount: number,
  weeklyGoal: number
): number {
  if (weeklyGoal <= 0 || completedCount <= 0) return 0;
  if (completedCount >= weeklyGoal) return 100;
  return Math.round(Math.pow(completedCount / weeklyGoal, 1.25) * 80);
}

/**
 * Calcula el avance y puntaje de la semana para un hábito dado.
 */
export function computeHabitWeeklyProgress(
  habit: HabitRecord,
  logsForHabit: HabitLogRecord[],
  referenceDateKey: string
): HabitWeeklyProgress {
  const weekDateKeys = getWeekDateKeys(referenceDateKey);
  const weekStartKey = weekDateKeys[0]!;
  const weekEndKey = weekDateKeys[6]!;
  const weekSet = new Set(weekDateKeys);

  const completedDateKeys = logsForHabit
    .filter(
      (log) =>
        !log.deletedAt &&
        log.habitId === habit.id &&
        weekSet.has(log.dateKey) &&
        isCompletedLog(log)
    )
    .map((log) => log.dateKey)
    .sort();

  const uniqueCompleted = Array.from(new Set(completedDateKeys));
  const completedThisWeek = uniqueCompleted.length;
  const weeklyGoal =
    habit.weeklyGoal && habit.weeklyGoal > 0 ? habit.weeklyGoal : null;
  const weekPoints = weeklyGoal
    ? computeWeeklyGoalPoints(completedThisWeek, weeklyGoal)
    : 0;
  const maxWeekPoints = weeklyGoal ? 100 : 0;
  const goalMet = weeklyGoal ? completedThisWeek >= weeklyGoal : false;
  const progressPercent = weeklyGoal
    ? Math.min(100, Math.round((completedThisWeek / weeklyGoal) * 100))
    : 0;

  return {
    weekStartKey,
    weekEndKey,
    weekDateKeys,
    completedThisWeek,
    completedDateKeys: uniqueCompleted,
    weeklyGoal,
    weekPoints,
    maxWeekPoints,
    goalMet,
    progressPercent,
  };
}

/**
 * Agrega el puntaje semanal actual y el acumulado de las últimas 12 semanas
 * para alimentar las insignias de cumplimiento.
 */
export function computeWeeklyScoreTotals(
  habits: HabitRecord[],
  allLogs: HabitLogRecord[],
  todayKey: string
): WeeklyScoreTotals {
  const activeHabits = habits.filter((h) => !h.deletedAt && !h.isArchived);
  const activeLogs = allLogs.filter((l) => !l.deletedAt);

  let currentWeekScore = 0;
  let currentWeekMaxScore = 0;
  let totalAchievementScore = 0;
  let weeklyGoalsMetTotal = 0;

  const weekRefs = Array.from({ length: 12 }, (_, w) =>
    shiftDateKey(todayKey, -w * 7)
  );
  const earliestWeekStart = getWeekDateKeys(weekRefs[weekRefs.length - 1]!)[0]!;

  for (const habit of activeHabits) {
    const habitLogs = activeLogs.filter((l) => l.habitId === habit.id);

    if (habit.weeklyGoal && habit.weeklyGoal > 0) {
      const current = computeHabitWeeklyProgress(habit, habitLogs, todayKey);
      currentWeekScore += current.weekPoints;
      currentWeekMaxScore += current.maxWeekPoints;

      for (const weekRef of weekRefs) {
        const weekProg = computeHabitWeeklyProgress(habit, habitLogs, weekRef);
        totalAchievementScore += weekProg.weekPoints;
        if (weekProg.goalMet) {
          weeklyGoalsMetTotal += 1;
        }
      }
    } else {
      const recentCompleted = habitLogs.filter(
        (l) =>
          l.dateKey >= earliestWeekStart &&
          l.dateKey <= todayKey &&
          isCompletedLog(l)
      ).length;
      totalAchievementScore += recentCompleted * 15;
    }
  }

  return {
    currentWeekScore,
    currentWeekMaxScore,
    totalAchievementScore,
    weeklyGoalsMetTotal,
  };
}
