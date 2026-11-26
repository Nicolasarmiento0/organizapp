export {
  shiftDateKey,
  getDayOfWeekFromDateKey,
  getWeekDateKeys,
  parseScheduledDays,
  isHabitScheduledOnDate,
  isHabitPausedOnDate,
  computeHabitStreakStats,
  computeAvailableRestShields,
  computeWeeklyGoalPoints,
  computeHabitWeeklyProgress,
  computeWeeklyScoreTotals,
  buildHeatmapCells,
  computeConsoleAnalytics,
  type HabitStreakStats,
  type RestShieldStats,
  type HeatmapCellData,
  type HeatmapRangeDays,
  type HabitConsoleAnalytics,
  type HabitWeeklyProgress,
  type WeeklyScoreTotals,
} from './streakEngine';
export { HABIT_ICON_OPTIONS, resolveHabitIcon, type HabitIconOption } from './habitIcons';
export {
  useHabitsManager,
  type EnrichedHabitItem,
  type UpsertHabitInput,
} from './useHabitsManager';
export { HabitEditorSheet, type HabitEditorSheetProps } from './HabitEditorSheet';
export {
  BinaryHabitDayPickerModal,
  type BinaryHabitDayPickerModalProps,
} from './BinaryHabitDayPickerModal';
export { TeslaBatteryMeter, type TeslaBatteryMeterProps } from './TeslaBatteryMeter';
export { HabitCard, type HabitCardProps } from './HabitCard';
export {
  HabitHeatmapConsole,
  type HabitHeatmapConsoleProps,
} from './HabitHeatmapConsole';
export { HabitKpiGrid, type HabitKpiGridProps } from './HabitKpiGrid';
export {
  computeHabitBadges,
  type HabitBadgeIconName,
  type HabitBadgeCategory,
  type HabitBadgeProgress,
  type BadgesSummary,
} from './badgesEngine';
export {
  HabitBadgesPanel,
  resolveBadgeIcon,
  type HabitBadgesPanelProps,
} from './HabitBadgesPanel';
