import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  Bell,
  Calendar,
  Check,
  CheckSquare,
  Circle,
  Clock,
  FileText,
  Flame,
  Moon,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Sun,
  X,
} from 'lucide-react-native';
import { iconMetrics, radii, spacing, type MacModuleType } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { LiquidGlassCard } from '../../src/components/glass/LiquidGlassCard';
import { MacIconBadge } from '../../src/components/glass/MacIconBadge';
import { useQuickCapture } from '../../src/components/glass/QuickCaptureContext';
import {
  MiniCalendarBento,
  ProgressRing,
  useDashboardData,
} from '../../src/features/dashboard';
import {
  subscribeSyncStatus,
  syncWithCloudflareD1,
  type SyncStatusSnapshot,
} from '../../src/db/sync';
import { authClient, resolveActiveUserId } from '../../src/services/authClient';

type ActivityFilter = 'all' | 'calendar' | 'reminders';

function formatHeaderDate(): string {
  try {
    const raw = new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    }).format(new Date());
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  } catch {
    return 'Hoy';
  }
}

function formatAlertClock(epochMs?: number | null): string | null {
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

function stripMarkdownPreview(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/-\s+\[[xX ]\]\s+/g, '')
    .replace(/[*_`>#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFirstTag(tagsJson: string): string {
  try {
    const parsed = JSON.parse(tagsJson) as unknown;
    if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
      return parsed[0];
    }
  } catch {
    // Ignorar JSON inválido
  }
  return 'Nota';
}

export default function DashboardBentoScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 960;
  const isTabletOrWide = width >= 640;

  const { theme, isDark, toggleTheme } = useTheme();
  const { openQuickCapture } = useQuickCapture();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const activeUserId = resolveActiveUserId(session?.user?.id);

  const {
    todayKey,
    selectedDateKey,
    setSelectedDateKey,
    calendarMonth,
    goToPrevMonth,
    goToNextMonth,
    goToToday,
    activeDaysInMonth,
    blocksForSelectedDate,
    tasks,
    habits,
    notes,
    telemetry,
    toggleHabitForToday,
    toggleTask,
  } = useDashboardData(activeUserId);

  const [searchQuery, setSearchQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [syncState, setSyncState] = useState<SyncStatusSnapshot>({
    status: 'idle',
    lastSyncedAt: 0,
    dirtyCount: 0,
    lastError: null,
  });

  useEffect(() => {
    return subscribeSyncStatus(setSyncState);
  }, []);

  const firstName = useMemo(() => {
    const rawName = session?.user?.name?.trim();
    if (!rawName) return 'Nico';
    return rawName.split(' ')[0] || 'Nico';
  }, [session?.user?.name]);

  const pendingTasks = useMemo(
    () => tasks.filter((t) => !t.isCompleted),
    [tasks]
  );

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    return {
      blocks: blocksForSelectedDate
        .filter((b) => b.title.toLowerCase().includes(q))
        .slice(0, 3),
      tasks: tasks
        .filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            (t.notes ?? '').toLowerCase().includes(q)
        )
        .slice(0, 4),
      habits: habits
        .filter((h) => h.title.toLowerCase().includes(q))
        .slice(0, 3),
      notes: notes
        .filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.contentMarkdown.toLowerCase().includes(q)
        )
        .slice(0, 3),
    };
  }, [searchQuery, blocksForSelectedDate, tasks, habits, notes]);

  const totalSearchHits = searchResults
    ? searchResults.blocks.length +
      searchResults.tasks.length +
      searchResults.habits.length +
      searchResults.notes.length
    : 0;

  const moduleCards: Array<{
    key: MacModuleType;
    title: string;
    subtitle: string;
    stat: string;
    icon: typeof Calendar;
    route: '/(tabs)/calendar' | '/(tabs)/reminders' | '/(tabs)/habits' | '/(tabs)/notes';
  }> = [
    {
      key: 'calendar',
      title: 'Calendario',
      subtitle: 'Estilo macOS',
      stat: `${blocksForSelectedDate.length} bloques`,
      icon: Calendar,
      route: '/(tabs)/calendar',
    },
    {
      key: 'reminders',
      title: 'Recordatorios',
      subtitle: 'Notificaciones',
      stat: `${telemetry.pendingTasks} pend.`,
      icon: Bell,
      route: '/(tabs)/reminders',
    },
    {
      key: 'habits',
      title: 'Hábitos',
      subtitle: 'Checklist + Premios',
      stat: `${telemetry.completedHabits}/${telemetry.totalHabits} hoy`,
      icon: CheckSquare,
      route: '/(tabs)/habits',
    },
    {
      key: 'notes',
      title: 'Notas',
      subtitle: 'Estilo Notion',
      stat: `${notes.length} páginas`,
      icon: FileText,
      route: '/(tabs)/notes',
    },
  ];

  const habitsPalette = theme.modules.habits;
  const remindersPalette = theme.modules.reminders;
  const notesPalette = theme.modules.notes;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.canvas }]}
      edges={['top']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: isDesktop ? 44 : 118 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. HEADER SUPERIOR */}
        <View style={styles.headerRow}>
          <View style={styles.greetingCol}>
            <Text style={[styles.greetingTitle, { color: theme.textPrimary }]}>
              Hola, {firstName}
            </Text>
            <Text style={[styles.greetingSub, { color: theme.textSecondary }]}>
              {formatHeaderDate()} · Listo para tus retos de hoy
            </Text>
          </View>

          <View style={styles.headerControls}>
            {/* Buscador global pill */}
            <View
              style={[
                styles.searchPill,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.glassBorder,
                  minWidth: isTabletOrWide ? 220 : 150,
                },
              ]}
            >
              <Search size={15} color={theme.textMuted} strokeWidth={2} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar en tu workspace..."
                placeholderTextColor={theme.textMuted}
                style={[styles.searchInput, { color: theme.textPrimary }]}
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <X size={14} color={theme.textMuted} strokeWidth={2} />
                </Pressable>
              ) : null}
            </View>

            {/* Sync status pill */}
            <Pressable
              onPress={() => void syncWithCloudflareD1()}
              style={[
                styles.syncPill,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.glassBorder,
                },
              ]}
            >
              <RefreshCw
                size={13}
                color={
                  syncState.status === 'synced'
                    ? theme.success
                    : theme.accentCobaltBright
                }
                strokeWidth={2}
              />
              <Text style={[styles.syncPillText, { color: theme.textPrimary }]}>
                {syncState.status === 'syncing'
                  ? 'Sync...'
                  : syncState.dirtyCount > 0
                    ? `0 ms · ${syncState.dirtyCount}`
                    : '0 ms · Local'}
              </Text>
            </Pressable>

            {/* Toggle de tema accesible */}
            {!isDesktop ? (
              <Pressable
                onPress={toggleTheme}
                style={[
                  styles.iconRoundBtn,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.glassBorder,
                  },
                ]}
                accessibilityLabel="Cambiar tema"
              >
                {isDark ? (
                  <Sun size={16} color={theme.accentVolt} strokeWidth={2} />
                ) : (
                  <Moon size={16} color={theme.textPrimary} strokeWidth={2} />
                )}
              </Pressable>
            ) : null}

            {/* Botón CTA + Nuevo */}
            <Pressable
              onPress={() => openQuickCapture('task')}
              style={({ pressed }) => [
                styles.newCtaBtn,
                { backgroundColor: theme.accentCobalt },
                pressed && { opacity: 0.88 },
              ]}
            >
              <Plus size={16} color="#FFFFFF" strokeWidth={2.3} />
              <Text style={styles.newCtaText}>Nuevo</Text>
            </Pressable>
          </View>
        </View>

        {/* Resultados de búsqueda rápida */}
        {searchResults ? (
          <LiquidGlassCard style={styles.searchResultsCard} contentStyle={styles.searchResultsContent}>
            <View style={styles.searchResultsHeader}>
              <Text style={[styles.searchResultsTitle, { color: theme.textPrimary }]}>
                Resultados para “{searchQuery.trim()}” ({totalSearchHits})
              </Text>
              <Pressable onPress={() => setSearchQuery('')}>
                <Text style={[styles.clearSearchText, { color: theme.accentCobaltBright }]}>
                  Cerrar
                </Text>
              </Pressable>
            </View>

            {totalSearchHits === 0 ? (
              <Text style={[styles.emptySearchText, { color: theme.textSecondary }]}>
                Sin coincidencias en bloques, recordatorios, hábitos o notas.
              </Text>
            ) : (
              <View style={styles.searchHitsList}>
                {searchResults.tasks.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => toggleTask(t.id)}
                    style={[styles.searchHitRow, { borderColor: theme.divider }]}
                  >
                    <Bell size={14} color={remindersPalette.icon} strokeWidth={2} />
                    <Text style={[styles.searchHitText, { color: theme.textPrimary }]} numberOfLines={1}>
                      {t.title}
                    </Text>
                    <Text style={[styles.searchHitTag, { color: theme.textMuted }]}>
                      {t.isCompleted ? 'Hecho' : 'Pendiente'}
                    </Text>
                  </Pressable>
                ))}
                {searchResults.habits.map((h) => (
                  <Pressable
                    key={h.id}
                    onPress={() => toggleHabitForToday(h.id)}
                    style={[styles.searchHitRow, { borderColor: theme.divider }]}
                  >
                    <Flame size={14} color={habitsPalette.icon} strokeWidth={2} />
                    <Text style={[styles.searchHitText, { color: theme.textPrimary }]} numberOfLines={1}>
                      {h.title}
                    </Text>
                    <Text style={[styles.searchHitTag, { color: habitsPalette.icon }]}>
                      {h.streak}d racha
                    </Text>
                  </Pressable>
                ))}
                {searchResults.blocks.map((b) => (
                  <Pressable
                    key={b.id}
                    onPress={() => router.push('/(tabs)/calendar')}
                    style={[styles.searchHitRow, { borderColor: theme.divider }]}
                  >
                    <Calendar size={14} color={theme.modules.calendar.icon} strokeWidth={2} />
                    <Text style={[styles.searchHitText, { color: theme.textPrimary }]} numberOfLines={1}>
                      {b.title}
                    </Text>
                    <Text style={[styles.searchHitTag, { color: theme.textMuted }]}>
                      {b.startTime}–{b.endTime}
                    </Text>
                  </Pressable>
                ))}
                {searchResults.notes.map((n) => (
                  <Pressable
                    key={n.id}
                    onPress={() => router.push('/(tabs)/notes')}
                    style={[styles.searchHitRow, { borderColor: theme.divider }]}
                  >
                    <FileText size={14} color={notesPalette.icon} strokeWidth={2} />
                    <Text style={[styles.searchHitText, { color: theme.textPrimary }]} numberOfLines={1}>
                      {n.title}
                    </Text>
                    <Text style={[styles.searchHitTag, { color: theme.textMuted }]}>
                      Nota
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </LiquidGlassCard>
        ) : null}

        {/* 2. FILA BENTO 1: RESUMEN DEL DÍA + MINI CALENDARIO */}
        <View
          style={[
            styles.bentoRow,
            { flexDirection: isDesktop ? 'row' : 'column' },
          ]}
        >
          {/* Tarjeta Hero Resumen del Día */}
          <LiquidGlassCard
            style={[styles.heroCard, isDesktop && { flex: 1.65 }]}
            contentStyle={styles.heroCardContent}
          >
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                  Resumen del Día
                </Text>
                <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                  {selectedDateKey === todayKey
                    ? 'Cockpit de rendimiento en tiempo real'
                    : `Vista filtrada · ${selectedDateKey}`}
                </Text>
              </View>
              <View
                style={[
                  styles.statusLivePill,
                  {
                    backgroundColor: theme.accentCobaltSoft,
                    borderColor: theme.accentCobaltBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusLiveText,
                    { color: theme.accentCobaltBright },
                  ]}
                >
                  Hoy
                </Text>
              </View>
            </View>

            {/* 3 métricas clave tabulares */}
            <View
              style={[
                styles.kpiRow,
                { flexDirection: isTabletOrWide ? 'row' : 'column' },
              ]}
            >
              <View
                style={[
                  styles.kpiCell,
                  {
                    backgroundColor: theme.cardElevated,
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.kpiAccentBar,
                    { backgroundColor: theme.accentCobaltBright },
                  ]}
                />
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
                  Agenda
                </Text>
                <Text style={[styles.kpiValue, { color: theme.textPrimary }]}>
                  {telemetry.scheduledHours}
                </Text>
                <Text style={[styles.kpiMeta, { color: theme.textMuted }]}>
                  {blocksForSelectedDate.length} bloques hoy
                </Text>
              </View>

              <View
                style={[
                  styles.kpiCell,
                  {
                    backgroundColor: theme.cardElevated,
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.kpiAccentBar,
                    { backgroundColor: remindersPalette.icon },
                  ]}
                />
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
                  Recordatorios
                </Text>
                <Text style={[styles.kpiValue, { color: theme.textPrimary }]}>
                  {telemetry.pendingTasks} pend.
                </Text>
                <Text style={[styles.kpiMeta, { color: theme.textMuted }]}>
                  {telemetry.pendingRemindersWithAlert} con aviso
                </Text>
              </View>

              <View
                style={[
                  styles.kpiCell,
                  {
                    backgroundColor: theme.cardElevated,
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.kpiAccentBar,
                    { backgroundColor: habitsPalette.icon },
                  ]}
                />
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
                  Hábitos
                </Text>
                <Text style={[styles.kpiValue, { color: theme.textPrimary }]}>
                  {telemetry.completedHabits}/{telemetry.totalHabits}
                </Text>
                <Text style={[styles.kpiMeta, { color: habitsPalette.icon }]}>
                  {telemetry.rewardPoints} pts acumulados
                </Text>
              </View>
            </View>

            <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />

            {/* Grilla de los 4 Módulos */}
            <View style={styles.modulesGrid}>
              {moduleCards.map((mod) => (
                <Pressable
                  key={mod.key}
                  onPress={() => router.push(mod.route)}
                  style={({ pressed }) => [
                    styles.moduleTile,
                    {
                      backgroundColor: theme.cardElevated,
                      borderColor: theme.glassBorder,
                      width: isTabletOrWide ? '48.8%' : '100%',
                    },
                    pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
                  ]}
                >
                  <View style={styles.moduleTileTop}>
                    <MacIconBadge
                      icon={mod.icon}
                      module={mod.key}
                      containerSize={36}
                      size={18}
                    />
                    <ArrowUpRight
                      size={16}
                      color={theme.textMuted}
                      strokeWidth={2}
                    />
                  </View>
                  <View style={styles.moduleTileText}>
                    <Text style={[styles.moduleTileTitle, { color: theme.textPrimary }]}>
                      {mod.title}
                    </Text>
                    <View style={styles.moduleTileBottomRow}>
                      <Text style={[styles.moduleTileSub, { color: theme.textSecondary }]}>
                        {mod.subtitle}
                      </Text>
                      <Text
                        style={[
                          styles.moduleTileStat,
                          { color: theme.modules[mod.key].icon },
                        ]}
                      >
                        {mod.stat}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </LiquidGlassCard>

          {/* Mini Calendario Cobalt */}
          <View style={isDesktop ? { flex: 1 } : undefined}>
            <MiniCalendarBento
              calendarMonth={calendarMonth}
              selectedDateKey={selectedDateKey}
              todayKey={todayKey}
              activeDaysInMonth={activeDaysInMonth}
              onSelectDate={setSelectedDateKey}
              onPrevMonth={goToPrevMonth}
              onNextMonth={goToNextMonth}
              onGoToday={goToToday}
              onOpenFullCalendar={() => router.push('/(tabs)/calendar')}
            />
          </View>
        </View>

        {/* 3. FILA BENTO 2: HÁBITOS + PREMIOS | ACTIVIDADES + NOTAS */}
        <View
          style={[
            styles.bentoRow,
            { flexDirection: isDesktop ? 'row' : 'column' },
          ]}
        >
          {/* Columna Izquierda: Hábitos de Hoy + Premio */}
          <View style={[styles.bentoColumn, isDesktop && { flex: 1 }]}>
            {/* Hábitos de Hoy */}
            <LiquidGlassCard style={styles.bentoCard} contentStyle={styles.bentoCardContent}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleWithBadge}>
                  <MacIconBadge
                    icon={Flame}
                    module="habits"
                    containerSize={34}
                    size={17}
                  />
                  <View>
                    <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                      Hábitos de Hoy
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                      Checklist diario 0 ms
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => router.push('/(tabs)/habits')}
                  style={styles.inlineLink}
                >
                  <Text style={[styles.inlineLinkText, { color: theme.accentCobaltBright }]}>
                    Ver todo
                  </Text>
                  <ArrowRight size={13} color={theme.accentCobaltBright} strokeWidth={2} />
                </Pressable>
              </View>

              <View style={styles.habitsSplitRow}>
                <View style={styles.habitsChecklistCol}>
                  {habits.slice(0, 4).map((habit) => {
                    const done = habit.completedToday;
                    return (
                      <Pressable
                        key={habit.id}
                        onPress={() => toggleHabitForToday(habit.id)}
                        style={[
                          styles.habitMiniRow,
                          {
                            backgroundColor: theme.cardElevated,
                            borderColor: done
                              ? habitsPalette.border
                              : theme.glassBorder,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.habitCheckBox,
                            {
                              borderColor: habitsPalette.icon,
                              backgroundColor: done
                                ? habitsPalette.icon
                                : 'transparent',
                            },
                          ]}
                        >
                          {done ? (
                            <Check
                              size={12}
                              color={isDark ? theme.accentVoltText : '#FFFFFF'}
                              strokeWidth={2.7}
                            />
                          ) : null}
                        </View>
                        <Text
                          style={[
                            styles.habitMiniTitle,
                            { color: theme.textPrimary },
                            done && {
                              textDecorationLine: 'line-through',
                              color: theme.textMuted,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {habit.title}
                        </Text>
                        <Text style={[styles.habitMiniStreak, { color: habitsPalette.icon }]}>
                          🔥 {habit.streak}d
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.ringWrapper}>
                  <ProgressRing
                    percentage={telemetry.habitPercent}
                    size={90}
                    strokeWidth={8}
                    label="Hoy"
                  />
                </View>
              </View>
            </LiquidGlassCard>

            {/* Premio por Cumplimiento */}
            <LiquidGlassCard style={styles.bentoCard} contentStyle={styles.bentoCardContent}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleWithBadge}>
                  <Award size={18} color={habitsPalette.icon} strokeWidth={2} />
                  <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                    Próximo Premio
                  </Text>
                </View>
                <Text style={[styles.rewardPercentText, { color: habitsPalette.icon }]}>
                  {telemetry.rewardProgressPercent}% completado
                </Text>
              </View>

              <Text style={[styles.rewardMetaTitle, { color: theme.textSecondary }]}>
                Meta: {telemetry.nextRewardTitle}
              </Text>

              <View style={[styles.linearTrack, { backgroundColor: theme.pillBg }]}>
                <View
                  style={[
                    styles.linearFill,
                    {
                      width: `${Math.max(6, telemetry.rewardProgressPercent)}%`,
                      backgroundColor: isDark ? theme.accentVolt : theme.success,
                    },
                  ]}
                />
              </View>

              <View style={styles.rewardBoundsRow}>
                <Text style={[styles.rewardBoundText, { color: theme.textMuted }]}>
                  {telemetry.rewardPoints} pts actuales
                </Text>
                <Text style={[styles.rewardBoundText, { color: theme.textPrimary }]}>
                  {telemetry.nextRewardTarget} pts
                </Text>
              </View>
            </LiquidGlassCard>
          </View>

          {/* Columna Derecha: Actividad & Avisos + Notas Rápidas */}
          <View style={[styles.bentoColumn, isDesktop && { flex: 1.45 }]}>
            {/* Actividad & Avisos */}
            <LiquidGlassCard style={styles.bentoCard} contentStyle={styles.bentoCardContent}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                    Actividad & Avisos
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                    Tienes {blocksForSelectedDate.length} bloques y {pendingTasks.length} pendientes
                  </Text>
                </View>

                <View style={styles.filterPillsGroup}>
                  {(
                    [
                      { key: 'all', label: 'Todo' },
                      { key: 'calendar', label: 'Calendario' },
                      { key: 'reminders', label: 'Recordatorios' },
                    ] as const
                  ).map((tab) => {
                    const active = activityFilter === tab.key;
                    const activeBg = isDark ? theme.accentVolt : theme.accentCobalt;
                    const activeTxt = isDark ? theme.accentVoltText : '#FFFFFF';

                    return (
                      <Pressable
                        key={tab.key}
                        onPress={() => setActivityFilter(tab.key)}
                        style={[
                          styles.segmentPill,
                          {
                            backgroundColor: active ? activeBg : theme.pillBg,
                            borderColor: active ? activeBg : theme.glassBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentPillText,
                            { color: active ? activeTxt : theme.textSecondary },
                            active && { fontWeight: '700' },
                          ]}
                        >
                          {tab.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Grilla compacta de bloques + recordatorios + tarjeta punteada */}
              <View style={styles.activityCardsGrid}>
                {activityFilter !== 'reminders'
                  ? blocksForSelectedDate.slice(0, 3).map((block, index) => {
                      const isPrimary = index === 0;
                      return (
                        <Pressable
                          key={block.id}
                          onPress={() => router.push('/(tabs)/calendar')}
                          style={({ pressed }) => [
                            styles.activityTile,
                            {
                              backgroundColor: isPrimary
                                ? theme.accentCobalt
                                : theme.cardElevated,
                              borderColor: isPrimary
                                ? 'rgba(255,255,255,0.18)'
                                : theme.glassBorder,
                              width: isTabletOrWide ? '48.6%' : '100%',
                            },
                            pressed && { opacity: 0.88 },
                          ]}
                        >
                          <View style={styles.activityTileTop}>
                            <View
                              style={[
                                styles.activityBadge,
                                {
                                  backgroundColor: isPrimary
                                    ? 'rgba(255,255,255,0.18)'
                                    : theme.modules.calendar.background,
                                },
                              ]}
                            >
                              <Clock
                                size={12}
                                color={
                                  isPrimary
                                    ? '#FFFFFF'
                                    : theme.modules.calendar.icon
                                }
                                strokeWidth={2}
                              />
                              <Text
                                style={[
                                  styles.activityBadgeText,
                                  {
                                    color: isPrimary
                                      ? '#FFFFFF'
                                      : theme.modules.calendar.icon,
                                  },
                                ]}
                              >
                                {block.startTime} – {block.endTime}
                              </Text>
                            </View>
                            <ArrowUpRight
                              size={15}
                              color={
                                isPrimary
                                  ? 'rgba(255,255,255,0.85)'
                                  : theme.textMuted
                              }
                              strokeWidth={2}
                            />
                          </View>

                          <Text
                            style={[
                              styles.activityTileTitle,
                              { color: isPrimary ? '#FFFFFF' : theme.textPrimary },
                            ]}
                            numberOfLines={2}
                          >
                            {block.title}
                          </Text>
                          <Text
                            style={[
                              styles.activityTileMeta,
                              {
                                color: isPrimary
                                  ? 'rgba(255,255,255,0.78)'
                                  : theme.textSecondary,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {block.blockType === 'deep_work'
                              ? 'Deep Work'
                              : block.blockType === 'work_shift'
                                ? 'Turno Laboral'
                                : 'Personal'}
                          </Text>
                        </Pressable>
                      );
                    })
                  : null}

                {activityFilter !== 'calendar'
                  ? pendingTasks.slice(0, 3).map((task) => {
                      const clock = formatAlertClock(task.reminderAt);
                      return (
                        <View
                          key={task.id}
                          style={[
                            styles.activityTile,
                            {
                              backgroundColor: theme.cardElevated,
                              borderColor: theme.glassBorder,
                              width: isTabletOrWide ? '48.6%' : '100%',
                            },
                          ]}
                        >
                          <View style={styles.activityTileTop}>
                            <Pressable
                              onPress={() => toggleTask(task.id)}
                              hitSlop={8}
                              style={styles.reminderToggleRow}
                            >
                              <Circle
                                size={18}
                                color={
                                  task.priority === 3
                                    ? remindersPalette.icon
                                    : theme.accentCobaltBright
                                }
                                strokeWidth={2}
                              />
                              <Text
                                style={[
                                  styles.priorityTag,
                                  {
                                    color:
                                      task.priority === 3
                                        ? remindersPalette.icon
                                        : theme.textSecondary,
                                  },
                                ]}
                              >
                                P{task.priority}
                              </Text>
                            </Pressable>

                            {clock ? (
                              <View
                                style={[
                                  styles.alertMiniPill,
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
                                    styles.alertMiniText,
                                    { color: remindersPalette.icon },
                                  ]}
                                >
                                  {clock}
                                </Text>
                              </View>
                            ) : null}
                          </View>

                          <Pressable onPress={() => toggleTask(task.id)}>
                            <Text
                              style={[
                                styles.activityTileTitle,
                                { color: theme.textPrimary },
                              ]}
                              numberOfLines={2}
                            >
                              {task.title}
                            </Text>
                          </Pressable>

                          <Text
                            style={[
                              styles.activityTileMeta,
                              { color: theme.textSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {task.notes || 'Recordatorio activo'}
                          </Text>
                        </View>
                      );
                    })
                  : null}

                {/* Tarjeta punteada + Añadir */}
                <Pressable
                  onPress={() =>
                    openQuickCapture(
                      activityFilter === 'calendar' ? 'schedule' : 'task'
                    )
                  }
                  style={({ pressed }) => [
                    styles.addDashedTile,
                    {
                      borderColor: theme.glassBorderStrong,
                      backgroundColor: theme.cardMuted,
                      width: isTabletOrWide ? '48.6%' : '100%',
                    },
                    pressed && { opacity: 0.78 },
                  ]}
                >
                  <Plus
                    size={22}
                    color={theme.textSecondary}
                    strokeWidth={iconMetrics.strokeWidth}
                  />
                  <Text
                    style={[styles.addDashedText, { color: theme.textSecondary }]}
                  >
                    {activityFilter === 'calendar'
                      ? 'Añadir Bloque'
                      : 'Añadir Actividad'}
                  </Text>
                </Pressable>
              </View>
            </LiquidGlassCard>

            {/* Notas Rápidas (Estilo Notion) */}
            <LiquidGlassCard style={styles.bentoCard} contentStyle={styles.bentoCardContent}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleWithBadge}>
                  <MacIconBadge
                    icon={FileText}
                    module="notes"
                    containerSize={34}
                    size={17}
                  />
                  <View>
                    <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                      Notas Rápidas
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                      Workspace estilo Notion
                    </Text>
                  </View>
                </View>

                <View style={styles.notesActionsRight}>
                  <Pressable
                    onPress={() => openQuickCapture('note')}
                    style={[
                      styles.smallNewNoteBtn,
                      {
                        backgroundColor: notesPalette.background,
                        borderColor: notesPalette.border,
                      },
                    ]}
                  >
                    <Plus size={13} color={notesPalette.icon} strokeWidth={2.3} />
                    <Text
                      style={[
                        styles.smallNewNoteText,
                        { color: notesPalette.icon },
                      ]}
                    >
                      Nueva Nota
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => router.push('/(tabs)/notes')}
                    style={styles.inlineLink}
                  >
                    <Text style={[styles.inlineLinkText, { color: theme.accentCobaltBright }]}>
                      Abrir
                    </Text>
                    <ArrowRight size={13} color={theme.accentCobaltBright} strokeWidth={2} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.notesList}>
                {notes.slice(0, 3).map((page) => {
                  const preview = stripMarkdownPreview(page.contentMarkdown);
                  const tagLabel = parseFirstTag(page.tags);
                  return (
                    <Pressable
                      key={page.id}
                      onPress={() => router.push('/(tabs)/notes')}
                      style={({ pressed }) => [
                        styles.noteRowCard,
                        {
                          backgroundColor: theme.cardElevated,
                          borderColor: theme.glassBorder,
                        },
                        pressed && { opacity: 0.84 },
                      ]}
                    >
                      <View style={styles.noteRowMain}>
                        <View style={styles.noteTitleRow}>
                          {page.isPinned ? (
                            <Pin
                              size={12}
                              color={notesPalette.icon}
                              strokeWidth={2.2}
                            />
                          ) : null}
                          <Text
                            style={[styles.noteTitle, { color: theme.textPrimary }]}
                            numberOfLines={1}
                          >
                            {page.title}
                          </Text>
                        </View>
                        <Text
                          style={[styles.noteExcerpt, { color: theme.textSecondary }]}
                          numberOfLines={1}
                        >
                          {preview || 'Página vacía lista para escribir...'}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.noteTagPill,
                          { backgroundColor: theme.pillBg },
                        ]}
                      >
                        <Text
                          style={[styles.noteTagText, { color: theme.textSecondary }]}
                        >
                          {tagLabel}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </LiquidGlassCard>
          </View>
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
    gap: spacing.md,
  },
  greetingCol: {
    gap: 2,
  },
  greetingTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  greetingSub: {
    fontSize: 13,
    fontWeight: '500',
  },
  headerControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 13,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    height: 38,
  },
  syncPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  iconRoundBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    paddingHorizontal: 15,
    height: 38,
  },
  newCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchResultsCard: {
    borderRadius: radii.lg,
  },
  searchResultsContent: {
    gap: spacing.sm,
  },
  searchResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchResultsTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  clearSearchText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptySearchText: {
    fontSize: 13,
  },
  searchHitsList: {
    gap: 6,
  },
  searchHitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  searchHitText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  searchHitTag: {
    fontSize: 11,
    fontWeight: '600',
  },
  bentoRow: {
    gap: spacing.lg,
  },
  bentoColumn: {
    gap: spacing.lg,
  },
  heroCard: {
    borderRadius: 24,
  },
  heroCardContent: {
    gap: spacing.md,
  },
  bentoCard: {
    borderRadius: 24,
  },
  bentoCardContent: {
    gap: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  statusLivePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  statusLiveText: {
    fontSize: 11,
    fontWeight: '700',
  },
  kpiRow: {
    gap: spacing.sm,
  },
  kpiCell: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: 4,
  },
  kpiAccentBar: {
    width: 24,
    height: 3,
    borderRadius: 2,
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  kpiMeta: {
    fontSize: 11,
    fontWeight: '500',
  },
  dividerLine: {
    height: 1,
    width: '100%',
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  moduleTile: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  moduleTileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moduleTileText: {
    gap: 2,
  },
  moduleTileTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  moduleTileBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  moduleTileSub: {
    fontSize: 12,
  },
  moduleTileStat: {
    fontSize: 12,
    fontWeight: '700',
  },
  inlineLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineLinkText: {
    fontSize: 12,
    fontWeight: '600',
  },
  habitsSplitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  habitsChecklistCol: {
    flex: 1,
    gap: spacing.xs,
  },
  habitMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.squircle,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  habitCheckBox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitMiniTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  habitMiniStreak: {
    fontSize: 11,
    fontWeight: '700',
  },
  ringWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  rewardPercentText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rewardMetaTitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  linearTrack: {
    height: 9,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  linearFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  rewardBoundsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rewardBoundText: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  filterPillsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  segmentPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  segmentPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  activityCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  activityTile: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    minHeight: 114,
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  activityTileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  activityBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  activityTileTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  activityTileMeta: {
    fontSize: 11,
    fontWeight: '500',
  },
  reminderToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityTag: {
    fontSize: 11,
    fontWeight: '700',
  },
  alertMiniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  alertMiniText: {
    fontSize: 11,
    fontWeight: '700',
  },
  addDashedTile: {
    borderRadius: radii.md,
    borderWidth: 1.4,
    borderStyle: 'dashed',
    minHeight: 114,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: spacing.md,
  },
  addDashedText: {
    fontSize: 13,
    fontWeight: '600',
  },
  notesActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  smallNewNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  smallNewNoteText: {
    fontSize: 11,
    fontWeight: '700',
  },
  notesList: {
    gap: spacing.xs,
  },
  noteRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.squircle,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  noteRowMain: {
    flex: 1,
    gap: 2,
  },
  noteTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  noteExcerpt: {
    fontSize: 12,
  },
  noteTagPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  noteTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
