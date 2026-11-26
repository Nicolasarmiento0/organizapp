import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HabitRecord, HabitTimeOfDay } from '@organiza/shared/schema';
import { Flame, Plus, Shield } from '../../src/components/icons';
import { radii, spacing, typography } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { LiquidGlassCard } from '../../src/components/glass/LiquidGlassCard';
import { MacIconBadge } from '../../src/components/glass/MacIconBadge';
import {
  BinaryHabitDayPickerModal,
  computeConsoleAnalytics,
  computeHabitBadges,
  HabitBadgesPanel,
  HabitCard,
  HabitEditorSheet,
  HabitHeatmapConsole,
  HabitKpiGrid,
  useHabitsManager,
  type UpsertHabitInput,
} from '../../src/features/habits';
import { authClient, resolveActiveUserId } from '../../src/services/authClient';

type RoutineFilter = 'all' | Exclude<HabitTimeOfDay, 'any'>;

const ROUTINE_FILTERS: Array<{ key: RoutineFilter; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'morning', label: 'Mañana' },
  { key: 'afternoon', label: 'Tarde' },
  { key: 'evening', label: 'Noche' },
];

export default function HabitsScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 980;
  const { theme } = useTheme();
  const { data: session } = authClient.useSession();
  const activeUserId = resolveActiveUserId(session?.user?.id);

  const {
    todayKey,
    yesterdayKey,
    activeDateKey,
    setActiveDateKey,
    habits,
    rawHabits,
    allLogs,
    shieldStats,
    yesterdayPendingCount,
    createHabit,
    updateHabit,
    deleteHabit,
    toggleBinaryHabit,
    adjustQuantitativeHabit,
    toggleRestShield,
  } = useHabitsManager(activeUserId);

  const [routineFilter, setRoutineFilter] = useState<RoutineFilter>('all');
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitRecord | null>(null);
  const [dayPickerHabitId, setDayPickerHabitId] = useState<string | null>(null);

  const dayPickerHabit = useMemo(
    () => habits.find((h) => h.id === dayPickerHabitId) ?? null,
    [habits, dayPickerHabitId]
  );

  const consoleAnalytics = useMemo(
    () => computeConsoleAnalytics(rawHabits, allLogs, todayKey),
    [rawHabits, allLogs, todayKey]
  );

  const badgesSummary = useMemo(
    () => computeHabitBadges(rawHabits, allLogs, todayKey),
    [rawHabits, allLogs, todayKey]
  );

  const orderedHabits = useMemo(() => {
    const filtered = habits.filter((h) =>
      routineFilter === 'all' ? true : h.timeOfDay === routineFilter
    );
    return [...filtered].sort((a, b) => {
      const aActive = a.isScheduledOnActiveDate && !a.isPausedOnActiveDate ? 0 : 1;
      const bActive = b.isScheduledOnActiveDate && !b.isPausedOnActiveDate ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      if (a.completedOnActiveDate !== b.completedOnActiveDate) {
        return a.completedOnActiveDate ? 1 : -1;
      }
      return b.computedStreak - a.computedStreak;
    });
  }, [habits, routineFilter]);

  const activeStats = useMemo(() => {
    const scheduled = habits.filter(
      (h) => h.isScheduledOnActiveDate && !h.isPausedOnActiveDate
    );
    const done = scheduled.filter((h) => h.completedOnActiveDate).length;
    return { done, total: scheduled.length };
  }, [habits]);

  const handleOpenCreate = () => {
    setEditingHabit(null);
    setEditorVisible(true);
  };

  const handleOpenEdit = (habit: HabitRecord) => {
    setEditingHabit(habit);
    setEditorVisible(true);
  };

  const handleSaveHabit = (input: UpsertHabitInput, existingId?: string) => {
    if (existingId) {
      updateHabit(existingId, input);
    } else {
      createHabit(input);
    }
  };

  const checklistSection = (
    <View style={[styles.checklistColumn, isDesktop && { flex: 1 }]}>
      <LiquidGlassCard style={styles.checklistPanel} contentStyle={styles.checklistContent}>
        {/* Header del Checklist */}
        <View style={styles.checklistHeader}>
          <View>
            <Text style={[styles.panelTitle, { color: theme.textPrimary }]}>
              Checklist Diario
            </Text>
            <Text style={[styles.panelSub, { color: theme.textSecondary }]}>
              {activeDateKey === todayKey ? 'Hoy' : 'Ayer'} · {activeStats.done}/
              {activeStats.total} completados
            </Text>
          </View>

          <View style={[styles.dateSwitchBox, { backgroundColor: theme.pillBg }]}>
            {(
              [
                { key: todayKey, label: 'Hoy' },
                { key: yesterdayKey, label: 'Ayer' },
              ] as const
            ).map((opt) => {
              const active = activeDateKey === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setActiveDateKey(opt.key)}
                  style={[
                    styles.dateSwitchBtn,
                    active && { backgroundColor: theme.accentPrimary },
                  ]}
                >
                  <Text
                    style={[
                      styles.dateSwitchText,
                      {
                        color: active
                          ? theme.accentPrimaryText
                          : theme.textSecondary,
                      },
                      active && { fontWeight: '700' },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Banner retroactivo si hay pendientes de ayer */}
        {activeDateKey === todayKey && yesterdayPendingCount > 0 ? (
          <Pressable
            onPress={() => setActiveDateKey(yesterdayKey)}
            style={[
              styles.yesterdayBanner,
              {
                backgroundColor: theme.accentPrimarySoft,
                borderColor: theme.accentPrimaryBorder,
              },
            ]}
          >
            <Text style={[styles.yesterdayBannerText, { color: theme.accentPrimaryLink }]}>
              Anoche quedaron {yesterdayPendingCount} hábito(s) sin registrar · Ir a Ayer →
            </Text>
          </Pressable>
        ) : null}

        {/* Filtro de rutina */}
        <View style={styles.routineRow}>
          {ROUTINE_FILTERS.map((rf) => {
            const active = routineFilter === rf.key;
            return (
              <Pressable
                key={rf.key}
                onPress={() => setRoutineFilter(rf.key)}
                style={[
                  styles.routineChip,
                  {
                    backgroundColor: active
                      ? theme.accentPrimarySoft
                      : theme.pillBg,
                    borderColor: active
                      ? theme.accentPrimaryBorder
                      : theme.glassBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.routineChipText,
                    {
                      color: active
                        ? theme.accentPrimaryLink
                        : theme.textSecondary,
                    },
                  ]}
                >
                  {rf.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Lista de Tarjetas */}
        <View style={styles.cardsList}>
          {orderedHabits.length === 0 ? (
            <View
              style={[
                styles.emptyBox,
                {
                  backgroundColor: theme.cardElevated,
                  borderColor: theme.glassBorder,
                },
              ]}
            >
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No hay hábitos en esta rutina.
              </Text>
            </View>
          ) : (
            orderedHabits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                availableShields={shieldStats.available}
                onToggleBinary={(id) => setDayPickerHabitId(id)}
                onAdjustQuant={adjustQuantitativeHabit}
                onToggleShield={toggleRestShield}
                onEdit={handleOpenEdit}
              />
            ))
          )}
        </View>

        {/* Botón punteado + Nuevo Hábito */}
        <Pressable
          onPress={handleOpenCreate}
          style={({ pressed }) => [
            styles.dashedAddBtn,
            {
              borderColor: theme.glassBorderStrong,
              backgroundColor: theme.cardMuted,
            },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Plus size={17} color={theme.textSecondary} strokeWidth={2} />
          <Text style={[styles.dashedAddText, { color: theme.textSecondary }]}>
            Añadir Nuevo Hábito
          </Text>
        </Pressable>
      </LiquidGlassCard>
    </View>
  );

  const consoleSection = (
    <View style={[styles.consoleColumn, isDesktop && { flex: 1.15 }]}>
      <HabitHeatmapConsole
        habits={rawHabits}
        allLogs={allLogs}
        todayKey={todayKey}
      />
      <HabitKpiGrid
        analytics={consoleAnalytics}
        shieldStats={shieldStats}
        unlockedBadges={badgesSummary.unlockedCount}
        totalBadges={badgesSummary.totalCount}
      />
      <HabitBadgesPanel summary={badgesSummary} />
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.canvas }]}
      edges={['top']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: isDesktop ? 48 : 118 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cabecera */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <MacIconBadge
              icon={Flame}
              module="habits"
              containerSize={40}
              size={20}
            />
            <View>
              <Text style={[styles.overline, { color: theme.accentPrimaryLink }]}>
                CONSOLA · RACHAS INTELIGENTES
              </Text>
              <Text style={[styles.screenTitle, { color: theme.textPrimary }]}>
                Tracker de Hábitos
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <View
              style={[
                styles.shieldPill,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.glassBorder,
                },
              ]}
            >
              <Shield size={13} color={theme.accentPrimaryLink} strokeWidth={2.1} />
              <Text style={[styles.shieldPillText, { color: theme.textPrimary }]}>
                {shieldStats.available}/{shieldStats.max} escudos
              </Text>
            </View>

            <Pressable
              onPress={handleOpenCreate}
              style={({ pressed }) => [
                styles.newHabitBtn,
                { backgroundColor: theme.accentPrimary },
                pressed && { opacity: 0.88 },
              ]}
            >
              <Plus size={16} color={theme.accentPrimaryText} strokeWidth={2.3} />
              <Text style={[styles.newHabitBtnText, { color: theme.accentPrimaryText }]}>
                Nuevo Hábito
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Cuerpo Principal Adaptativo */}
        {isDesktop ? (
          <View style={styles.desktopSplit}>
            {consoleSection}
            {checklistSection}
          </View>
        ) : (
          <View style={styles.mobileStack}>
            {checklistSection}
            {consoleSection}
          </View>
        )}
      </ScrollView>

      <HabitEditorSheet
        visible={editorVisible}
        habitToEdit={editingHabit}
        onClose={() => setEditorVisible(false)}
        onSave={handleSaveHabit}
        onDelete={deleteHabit}
      />

      <BinaryHabitDayPickerModal
        visible={Boolean(dayPickerHabit)}
        habit={dayPickerHabit}
        todayKey={todayKey}
        onClose={() => setDayPickerHabitId(null)}
        onToggleDate={toggleBinaryHabit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    maxWidth: 1260,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  overline: {
    fontSize: 10,
    ...typography.eyebrow,
  },
  screenTitle: {
    fontSize: 24,
    ...typography.screenTitle,
  },
  shieldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 11,
    height: 36,
  },
  shieldPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  newHabitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    height: 36,
  },
  newHabitBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  desktopSplit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  mobileStack: {
    gap: spacing.lg,
  },
  consoleColumn: {
    gap: spacing.md,
  },
  checklistColumn: {
    gap: spacing.md,
  },
  checklistPanel: {
    borderRadius: 24,
  },
  checklistContent: {
    gap: spacing.md,
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  panelTitle: {
    fontSize: 17,
    ...typography.cardTitle,
  },
  panelSub: {
    fontSize: 12,
    marginTop: 1,
  },
  dateSwitchBox: {
    flexDirection: 'row',
    borderRadius: radii.pill,
    padding: 3,
    gap: 2,
  },
  dateSwitchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  dateSwitchText: {
    fontSize: 12,
    fontWeight: '600',
  },
  yesterdayBanner: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  yesterdayBannerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  routineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  routineChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  routineChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardsList: {
    gap: spacing.sm,
  },
  emptyBox: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
  },
  dashedAddBtn: {
    borderWidth: 1.4,
    borderStyle: 'dashed',
    borderRadius: radii.md,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dashedAddText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
