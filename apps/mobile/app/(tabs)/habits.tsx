import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Award, Check, Flame, Plus, Sparkles } from 'lucide-react-native';
import { radii, spacing } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { LiquidGlassCard } from '../../src/components/glass/LiquidGlassCard';
import { MacIconBadge } from '../../src/components/glass/MacIconBadge';
import { useTodayCockpit } from '../../src/features/today';
import { authClient, resolveActiveUserId } from '../../src/services/authClient';

export default function HabitsScreen() {
  const { theme } = useTheme();
  const { data: session } = authClient.useSession();
  const activeUserId = resolveActiveUserId(session?.user?.id);
  const { habits, metrics, createHabit, toggleHabitForToday } =
    useTodayCockpit(activeUserId);

  const [newHabitTitle, setNewHabitTitle] = useState('');
  const habitsPalette = theme.modules.habits;

  const rewardStats = useMemo(() => {
    const totalStreakDays = habits.reduce((acc, h) => acc + h.streak, 0);
    const points = totalStreakDays * 10 + metrics.completedHabits * 25;
    const target = Math.max(250, Math.ceil((points + 1) / 250) * 250);
    const progress = Math.min(100, Math.round((points / target) * 100));
    const percentToday =
      metrics.totalHabits > 0
        ? Math.round((metrics.completedHabits / metrics.totalHabits) * 100)
        : 0;
    return { totalStreakDays, points, target, progress, percentToday };
  }, [habits, metrics]);

  const handleAddHabit = () => {
    const clean = newHabitTitle.trim();
    if (!clean) return;
    createHabit({
      title: clean,
      icon: 'Sparkles',
      frequency: 'daily',
      reminderTime: '09:00',
    });
    setNewHabitTitle('');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.canvas }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
              <Text style={[styles.overline, { color: habitsPalette.icon }]}>
                FASE 4 • CHECKLIST & PREMIOS
              </Text>
              <Text style={[styles.screenTitle, { color: theme.textPrimary }]}>
                Tracker de Hábitos
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.counterPill,
              {
                backgroundColor: habitsPalette.background,
                borderColor: habitsPalette.border,
              },
            ]}
          >
            <Text style={[styles.counterPillText, { color: habitsPalette.icon }]}>
              {metrics.completedHabits}/{metrics.totalHabits} hoy · {rewardStats.percentToday}%
            </Text>
          </View>
        </View>

        {/* Tarjeta resumen de Puntos y Premios */}
        <LiquidGlassCard style={styles.rewardCard} contentStyle={styles.rewardContent}>
          <View style={styles.rewardHeader}>
            <View style={styles.rewardTitleGroup}>
              <Award size={18} color={habitsPalette.icon} strokeWidth={2} />
              <Text style={[styles.rewardTitle, { color: theme.textPrimary }]}>
                Puntos & Próximo Premio
              </Text>
            </View>
            <Text style={[styles.rewardPts, { color: habitsPalette.icon }]}>
              {rewardStats.points} / {rewardStats.target} pts
            </Text>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: theme.pillBg }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.max(6, rewardStats.progress)}%`,
                  backgroundColor: habitsPalette.icon,
                },
              ]}
            />
          </View>

          <Text style={[styles.rewardSub, { color: theme.textSecondary }]}>
            Completa tu checklist diario para sumar +25 pts por hábito y sostener tu racha ({rewardStats.totalStreakDays} días acumulados).
          </Text>
        </LiquidGlassCard>

        {/* Añadir hábito rápido */}
        <LiquidGlassCard variant="solid" noPadding style={styles.quickCard}>
          <View style={styles.quickRow}>
            <TextInput
              value={newHabitTitle}
              onChangeText={setNewHabitTitle}
              placeholder="Nuevo hábito diario (ej. Leer 20 páginas)..."
              placeholderTextColor={theme.textMuted}
              style={[styles.quickInput, { color: theme.textPrimary }]}
              returnKeyType="done"
              onSubmitEditing={handleAddHabit}
            />
            <Pressable
              onPress={handleAddHabit}
              style={[
                styles.addBtn,
                { backgroundColor: theme.accentCobalt },
                !newHabitTitle.trim() && { opacity: 0.45 },
              ]}
            >
              <Plus size={18} color="#FFFFFF" strokeWidth={2.2} />
            </Pressable>
          </View>
        </LiquidGlassCard>

        {/* Checklist diario */}
        <View style={styles.listStack}>
          {habits.map((habit) => {
            const isDone = habit.completedToday;
            return (
              <Pressable
                key={habit.id}
                onPress={() => toggleHabitForToday(habit.id)}
              >
                <LiquidGlassCard
                  noPadding
                  style={styles.itemCard}
                  contentStyle={styles.itemRow}
                >
                  <View
                    style={[
                      styles.checkSquare,
                      {
                        borderColor: habitsPalette.icon,
                        backgroundColor: isDone
                          ? habitsPalette.icon
                          : theme.inputBg,
                      },
                    ]}
                  >
                    {isDone ? (
                      <Check
                        size={15}
                        color={theme.accentVoltText}
                        strokeWidth={2.6}
                      />
                    ) : null}
                  </View>

                  <View style={styles.itemBody}>
                    <Text
                      style={[
                        styles.itemTitle,
                        { color: theme.textPrimary },
                        isDone && {
                          textDecorationLine: 'line-through',
                          color: theme.textMuted,
                        },
                      ]}
                    >
                      {habit.title}
                    </Text>
                    <View style={styles.metaRow}>
                      <Sparkles size={12} color={theme.textMuted} strokeWidth={1.8} />
                      <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                        {habit.reminderTime
                          ? `Aviso sugerido ${habit.reminderTime}`
                          : 'Frecuencia diaria'}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.streakBadge,
                      { backgroundColor: habitsPalette.background },
                    ]}
                  >
                    <Flame size={13} color={habitsPalette.icon} strokeWidth={2} />
                    <Text style={[styles.streakText, { color: habitsPalette.icon }]}>
                      {habit.streak}d
                    </Text>
                  </View>
                </LiquidGlassCard>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 120,
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
  overline: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  counterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  counterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rewardCard: {
    borderRadius: radii.lg,
  },
  rewardContent: {
    gap: spacing.sm,
  },
  rewardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rewardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rewardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  rewardPts: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  rewardSub: {
    fontSize: 12,
    lineHeight: 18,
  },
  quickCard: {
    borderRadius: radii.md,
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    gap: spacing.sm,
  },
  quickInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    fontWeight: '500',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listStack: {
    gap: spacing.sm,
  },
  itemCard: {
    borderRadius: radii.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: spacing.md,
  },
  checkSquare: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
    gap: 3,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  itemMeta: {
    fontSize: 12,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
