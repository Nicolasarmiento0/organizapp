import type { HabitLogRecord, HabitRecord } from '@organiza/shared/schema';
import {
  computeConsoleAnalytics,
  computeWeeklyScoreTotals,
} from './streakEngine';

export type HabitBadgeIconName =
  | 'Sparkles'
  | 'CheckCircle2'
  | 'Flame'
  | 'Zap'
  | 'Trophy'
  | 'Target'
  | 'TrendingUp'
  | 'Shield'
  | 'Award'
  | 'Crown'
  | 'Star'
  | 'Calendar';

export type HabitBadgeCategory = 'streaks' | 'milestones';

export interface HabitBadgeProgress {
  id: string;
  title: string;
  description: string;
  category: HabitBadgeCategory;
  shortTag: string;
  icon: HabitBadgeIconName;
  /** Reservado para futuras ilustraciones personalizadas de insignias */
  badgeAsset?: string | null;
  unlocked: boolean;
  current: number;
  target: number;
  progressPercent: number;
  progressLabel: string;
}

export interface BadgesSummary {
  badges: HabitBadgeProgress[];
  unlockedCount: number;
  totalCount: number;
  nextBadge: HabitBadgeProgress | null;
  totalAchievementScore: number;
  currentWeekScore: number;
  currentWeekMaxScore: number;
  weeklyGoalsMetTotal: number;
}

function buildBadge(params: {
  id: string;
  title: string;
  description: string;
  category: HabitBadgeCategory;
  shortTag: string;
  icon: HabitBadgeIconName;
  current: number;
  target: number;
  unitLabel: string;
}): HabitBadgeProgress {
  const safeTarget = Math.max(1, params.target);
  const clampedCurrent = Math.max(0, Math.min(safeTarget, params.current));
  const unlocked = params.current >= safeTarget;
  const progressPercent = unlocked
    ? 100
    : Math.min(99, Math.round((clampedCurrent / safeTarget) * 100));

  const progressLabel =
    params.unitLabel === '%'
      ? `${Math.min(100, Math.max(0, params.current))}% / ${safeTarget}%`
      : `${clampedCurrent} / ${safeTarget} ${params.unitLabel}`;

  return {
    id: params.id,
    title: params.title,
    description: params.description,
    category: params.category,
    shortTag: params.shortTag,
    icon: params.icon,
    badgeAsset: null,
    unlocked,
    current: clampedCurrent,
    target: safeTarget,
    progressPercent,
    progressLabel,
  };
}

const STREAK_LADDER: ReadonlyArray<{
  id: string;
  title: string;
  shortTag: string;
  days: number;
  icon: HabitBadgeIconName;
}> = [
  { id: 'streak_1w', title: '1 Semana', shortTag: '1 sem', days: 7, icon: 'Flame' },
  { id: 'streak_2w', title: '2 Semanas', shortTag: '2 sem', days: 14, icon: 'Flame' },
  { id: 'streak_3w', title: '3 Semanas', shortTag: '3 sem', days: 21, icon: 'Zap' },
  { id: 'streak_1m', title: '1 Mes', shortTag: '1 mes', days: 30, icon: 'Calendar' },
  { id: 'streak_2m', title: '2 Meses', shortTag: '2m', days: 60, icon: 'Calendar' },
  { id: 'streak_3m', title: '3 Meses', shortTag: '3m', days: 90, icon: 'Star' },
  { id: 'streak_4m', title: '4 Meses', shortTag: '4m', days: 120, icon: 'Star' },
  { id: 'streak_5m', title: '5 Meses', shortTag: '5m', days: 150, icon: 'Award' },
  { id: 'streak_6m', title: '6 Meses', shortTag: '6m', days: 180, icon: 'Award' },
  { id: 'streak_7m', title: '7 Meses', shortTag: '7m', days: 210, icon: 'Award' },
  { id: 'streak_8m', title: '8 Meses', shortTag: '8m', days: 240, icon: 'Trophy' },
  { id: 'streak_9m', title: '9 Meses', shortTag: '9m', days: 270, icon: 'Trophy' },
  { id: 'streak_10m', title: '10 Meses', shortTag: '10m', days: 300, icon: 'Trophy' },
  { id: 'streak_11m', title: '11 Meses', shortTag: '11m', days: 330, icon: 'Trophy' },
  { id: 'streak_1y', title: '1 Año', shortTag: '1 año', days: 365, icon: 'Crown' },
  { id: 'streak_2y', title: '2 Años', shortTag: '2 años', days: 730, icon: 'Crown' },
  { id: 'streak_3y', title: '3 Años', shortTag: '3 años', days: 1095, icon: 'Crown' },
];

/**
 * Evalúa las 24 insignias de cumplimiento (17 de rachas largas + 7 de logros/objetivos)
 * alimentadas por rachas reales, consistencia y puntaje semanal.
 */
export function computeHabitBadges(
  habits: HabitRecord[],
  allLogs: HabitLogRecord[],
  todayKey: string
): BadgesSummary {
  const activeLogs = allLogs.filter((l) => !l.deletedAt);
  const completedLogsCount = activeLogs.filter(
    (l) => l.status === 'completed' || l.isCompleted
  ).length;
  const totalShieldsUsed = activeLogs.filter(
    (l) => l.status === 'rest_shield'
  ).length;

  const consoleStats = computeConsoleAnalytics(habits, activeLogs, todayKey);
  const weeklyTotals = computeWeeklyScoreTotals(habits, activeLogs, todayKey);

  const milestoneBadges: HabitBadgeProgress[] = [
    buildBadge({
      id: 'first_step',
      title: 'Primer Paso',
      description: 'Completa tu primer hábito registrado.',
      category: 'milestones',
      shortTag: 'Inicio',
      icon: 'Sparkles',
      current: completedLogsCount,
      target: 1,
      unitLabel: 'logro',
    }),
    buildBadge({
      id: 'weekly_goal_met',
      title: 'Meta Semanal',
      description: 'Cumple al 100% un objetivo semanal para obtener puntaje máximo.',
      category: 'milestones',
      shortTag: 'Meta',
      icon: 'Target',
      current: weeklyTotals.weeklyGoalsMetTotal,
      target: 1,
      unitLabel: 'meta',
    }),
    buildBadge({
      id: 'perfect_day',
      title: 'Día Perfecto',
      description: 'Cumple el 100% de tus hábitos programados en un día.',
      category: 'milestones',
      shortTag: '100%',
      icon: 'CheckCircle2',
      current: consoleStats.perfectDays30d,
      target: 1,
      unitLabel: 'día',
    }),
    buildBadge({
      id: 'score_250',
      title: 'Puntaje 250 pts',
      description: 'Suma 250 pts cumpliendo tus objetivos semanales y hábitos.',
      category: 'milestones',
      shortTag: '250 pts',
      icon: 'Zap',
      current: weeklyTotals.totalAchievementScore,
      target: 250,
      unitLabel: 'pts',
    }),
    buildBadge({
      id: 'score_750',
      title: 'Puntaje 750 pts',
      description: 'Alcanza 750 pts acumulados de cumplimiento.',
      category: 'milestones',
      shortTag: '750 pts',
      icon: 'Trophy',
      current: weeklyTotals.totalAchievementScore,
      target: 750,
      unitLabel: 'pts',
    }),
    buildBadge({
      id: 'consistency_80',
      title: 'Constancia 80%',
      description: 'Alcanza al menos 80% de cumplimiento en 30 días.',
      category: 'milestones',
      shortTag: '80% 30D',
      icon: 'TrendingUp',
      current: consoleStats.consistency30dPercent,
      target: 80,
      unitLabel: '%',
    }),
    buildBadge({
      id: 'strategist_shield',
      title: 'Estratega',
      description: 'Protege una racha usando un Escudo de Descanso.',
      category: 'milestones',
      shortTag: 'Escudo',
      icon: 'Shield',
      current: totalShieldsUsed,
      target: 1,
      unitLabel: 'escudo',
    }),
  ];

  const streakBadges: HabitBadgeProgress[] = STREAK_LADDER.map((tier) =>
    buildBadge({
      id: tier.id,
      title: tier.title,
      description: `Sostén una racha de ${tier.days} días (${tier.title.toLowerCase()}) en cualquier hábito.`,
      category: 'streaks',
      shortTag: tier.shortTag,
      icon: tier.icon,
      current: consoleStats.bestHistoricalStreak,
      target: tier.days,
      unitLabel: 'días',
    })
  );

  const badges = [...milestoneBadges, ...streakBadges];
  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const locked = badges.filter((b) => !b.unlocked);
  const nextBadge =
    locked.length > 0
      ? [...locked].sort((a, b) => {
          if (b.progressPercent !== a.progressPercent) {
            return b.progressPercent - a.progressPercent;
          }
          return a.target - b.target;
        })[0]!
      : null;

  return {
    badges,
    unlockedCount,
    totalCount: badges.length,
    nextBadge,
    totalAchievementScore: weeklyTotals.totalAchievementScore,
    currentWeekScore: weeklyTotals.currentWeekScore,
    currentWeekMaxScore: weeklyTotals.currentWeekMaxScore,
    weeklyGoalsMetTotal: weeklyTotals.weeklyGoalsMetTotal,
  };
}
