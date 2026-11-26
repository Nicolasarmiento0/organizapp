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
import {
  Bell,
  Check,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
} from 'lucide-react-native';
import { iconMetrics, radii, spacing } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { LiquidGlassCard } from '../../src/components/glass/LiquidGlassCard';
import { MacIconBadge } from '../../src/components/glass/MacIconBadge';
import { useTodayCockpit } from '../../src/features/today';
import { authClient, resolveActiveUserId } from '../../src/services/authClient';

type ReminderFilter = 'all' | 'pending' | 'alerts' | 'completed';

function formatReminderClock(epochMs?: number | null): string | null {
  if (!epochMs) return null;
  try {
    return new Date(epochMs).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

export default function RemindersScreen() {
  const { theme } = useTheme();
  const { data: session } = authClient.useSession();
  const activeUserId = resolveActiveUserId(session?.user?.id);
  const { tasks, metrics, createTask, toggleTask, deleteTask } =
    useTodayCockpit(activeUserId);

  const [filter, setFilter] = useState<ReminderFilter>('all');
  const [quickTitle, setQuickTitle] = useState('');
  const [withAlert30m, setWithAlert30m] = useState(true);

  const remindersPalette = theme.modules.reminders;

  const filteredTasks = useMemo(() => {
    return tasks.filter((item) => {
      if (filter === 'pending') return !item.isCompleted;
      if (filter === 'alerts') return Boolean(item.reminderAt) && !item.isCompleted;
      if (filter === 'completed') return item.isCompleted;
      return true;
    });
  }, [tasks, filter]);

  const alertCount = useMemo(
    () => tasks.filter((t) => Boolean(t.reminderAt) && !t.isCompleted).length,
    [tasks]
  );

  const handleCreate = () => {
    const clean = quickTitle.trim();
    if (!clean) return;
    createTask({
      title: clean,
      category: withAlert30m ? 'reminder' : 'today',
      priority: 2,
      reminderAt: withAlert30m ? Date.now() + 30 * 60 * 1000 : null,
    });
    setQuickTitle('');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.canvas }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cabecera estilo macOS */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <MacIconBadge
              icon={Bell}
              module="reminders"
              containerSize={40}
              size={20}
            />
            <View>
              <Text style={[styles.overline, { color: remindersPalette.icon }]}>
                FASE 3 • AVISOS & RECORDATORIOS
              </Text>
              <Text style={[styles.screenTitle, { color: theme.textPrimary }]}>
                Recordatorios
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.summaryPill,
              {
                backgroundColor: remindersPalette.background,
                borderColor: remindersPalette.border,
              },
            ]}
          >
            <Bell size={13} color={remindersPalette.icon} strokeWidth={2} />
            <Text style={[styles.summaryPillText, { color: remindersPalette.icon }]}>
              {alertCount} con aviso · {metrics.pendingTasks} pend.
            </Text>
          </View>
        </View>

        {/* Captura rápida de recordatorio */}
        <LiquidGlassCard variant="solid" noPadding style={styles.quickCard}>
          <View style={styles.quickRow}>
            <TextInput
              value={quickTitle}
              onChangeText={setQuickTitle}
              placeholder="Nuevo recordatorio o aviso rápido..."
              placeholderTextColor={theme.textMuted}
              style={[styles.quickInput, { color: theme.textPrimary }]}
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <Pressable
              onPress={() => setWithAlert30m((prev) => !prev)}
              style={[
                styles.alertTogglePill,
                {
                  backgroundColor: withAlert30m
                    ? remindersPalette.background
                    : theme.pillBg,
                  borderColor: withAlert30m
                    ? remindersPalette.border
                    : theme.glassBorder,
                },
              ]}
            >
              <Bell
                size={12}
                color={withAlert30m ? remindersPalette.icon : theme.textSecondary}
                strokeWidth={2}
              />
              <Text
                style={[
                  styles.alertToggleText,
                  {
                    color: withAlert30m
                      ? remindersPalette.icon
                      : theme.textSecondary,
                  },
                ]}
              >
                +30m
              </Text>
            </Pressable>
            <Pressable
              onPress={handleCreate}
              style={[
                styles.addBtn,
                { backgroundColor: theme.accentCobalt },
                !quickTitle.trim() && { opacity: 0.45 },
              ]}
            >
              <Plus size={18} color="#FFFFFF" strokeWidth={2.2} />
            </Pressable>
          </View>
        </LiquidGlassCard>

        {/* Filtros */}
        <View style={styles.filtersRow}>
          {(
            [
              { key: 'all', label: 'Todos' },
              { key: 'pending', label: 'Pendientes' },
              { key: 'alerts', label: 'Con Aviso' },
              { key: 'completed', label: 'Completados' },
            ] as const
          ).map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: active ? theme.accentCobalt : theme.card,
                    borderColor: active ? theme.accentCobalt : theme.glassBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: active ? '#FFFFFF' : theme.textSecondary },
                    active && { fontWeight: '700' },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Lista de recordatorios */}
        <View style={styles.listStack}>
          {filteredTasks.length === 0 ? (
            <LiquidGlassCard style={styles.emptyCard}>
              <CheckCircle2
                size={26}
                color={theme.textMuted}
                strokeWidth={iconMetrics.strokeWidth}
              />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No hay recordatorios en esta vista.
              </Text>
            </LiquidGlassCard>
          ) : (
            filteredTasks.map((task) => {
              const clock = formatReminderClock(task.reminderAt);
              const priorityColor =
                task.priority === 3
                  ? remindersPalette.icon
                  : task.priority === 2
                    ? theme.accentCobaltBright
                    : theme.textSecondary;

              return (
                <LiquidGlassCard
                  key={task.id}
                  noPadding
                  style={styles.itemCard}
                  contentStyle={styles.itemRow}
                >
                  <Pressable onPress={() => toggleTask(task.id)} hitSlop={10}>
                    {task.isCompleted ? (
                      <View
                        style={[
                          styles.checkedCircle,
                          { backgroundColor: theme.accentVolt },
                        ]}
                      >
                        <Check size={14} color={theme.accentVoltText} strokeWidth={2.5} />
                      </View>
                    ) : (
                      <Circle size={22} color={priorityColor} strokeWidth={1.9} />
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => toggleTask(task.id)}
                    style={styles.itemBody}
                  >
                    <Text
                      style={[
                        styles.itemTitle,
                        { color: theme.textPrimary },
                        task.isCompleted && {
                          textDecorationLine: 'line-through',
                          color: theme.textMuted,
                        },
                      ]}
                    >
                      {task.title}
                    </Text>
                    {task.notes ? (
                      <Text
                        style={[styles.itemNotes, { color: theme.textSecondary }]}
                        numberOfLines={2}
                      >
                        {task.notes}
                      </Text>
                    ) : null}
                    <View style={styles.chipsRow}>
                      <View
                        style={[
                          styles.metaChip,
                          { borderColor: priorityColor },
                        ]}
                      >
                        <Text style={[styles.metaChipText, { color: priorityColor }]}>
                          P{task.priority}
                        </Text>
                      </View>
                      {clock ? (
                        <View
                          style={[
                            styles.clockChip,
                            { backgroundColor: remindersPalette.background },
                          ]}
                        >
                          <Bell
                            size={11}
                            color={remindersPalette.icon}
                            strokeWidth={2}
                          />
                          <Text
                            style={[
                              styles.clockChipText,
                              { color: remindersPalette.icon },
                            ]}
                          >
                            {clock}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>

                  <Pressable onPress={() => deleteTask(task.id)} hitSlop={10}>
                    <Trash2
                      size={16}
                      color={theme.textMuted}
                      strokeWidth={iconMetrics.strokeWidth}
                    />
                  </Pressable>
                </LiquidGlassCard>
              );
            })
          )}
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
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  summaryPillText: {
    fontSize: 12,
    fontWeight: '600',
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
  alertTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  alertToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  filterPill: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '500',
  },
  listStack: {
    gap: spacing.sm,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
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
  checkedCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  itemNotes: {
    fontSize: 13,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  metaChip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  clockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  clockChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
