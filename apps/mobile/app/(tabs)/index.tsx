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
  Trophy,
  User,
  X,
} from '../../src/components/icons';
import { iconMetrics, radii, spacing, typography, type MacModuleType } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { LiquidGlassCard } from '../../src/components/glass/LiquidGlassCard';
import { MacIconBadge } from '../../src/components/glass/MacIconBadge';
import { useQuickCapture } from '../../src/components/glass/QuickCaptureContext';
import { useAccountSheet } from '../../src/components/auth/AccountSheet';
import {
  MiniCalendarBento,
  ProgressRing,
  useDashboardData,
} from '../../src/features/dashboard';
import {
  BinaryHabitDayPickerModal,
  resolveBadgeIcon,
} from '../../src/features/habits';
import {
  insertNotePageOfflineFirst,
  instantiateNoteTemplate,
  resolveNoteIcon,
  type NoteTemplateId,
} from '../../src/features/notes';
import {
  subscribeSyncStatus,
  syncWithCloudflareD1,
  type SyncStatusSnapshot,
} from '../../src/db/sync';
import {
  authClient,
  getUserInitials,
  resolveActiveUserId,
} from '../../src/services/authClient';

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
  const { openAccountSheet } = useAccountSheet();
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
    allEnrichedHabits,
    badgesSummary,
    notes,
    telemetry,
    handleQuickHabitTap,
    toggleBinaryHabitForDate,
    toggleTask,
  } = useDashboardData(activeUserId);

  const [searchQuery, setSearchQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [dayPickerHabitId, setDayPickerHabitId] = useState<string | null>(null);
  const dayPickerHabit = useMemo(
    () => allEnrichedHabits.find((h) => h.id === dayPickerHabitId) ?? null,
    [allEnrichedHabits, dayPickerHabitId]
  );
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

  const userInitials = useMemo(
    () => getUserInitials(session?.user?.name, session?.user?.email),
    [session?.user?.name, session?.user?.email]
  );

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
      subtitle: 'Checklist + Insignias',
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

  const isAuthenticated = Boolean(session?.user);

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
                  minWidth: isTabletOrWide ? 220 : 145,
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
                    : theme.textSecondary
                }
                strokeWidth={2}
              />
              <Text style={[styles.syncPillText, { color: theme.textPrimary }]}>
                {syncState.status === 'syncing'
                  ? 'Sync...'
                  : syncState.dirtyCount > 0
                    ? `0 ms · ${syncState.dirtyCount}`
                    : isAuthenticated
                      ? 'D1 Sync'
                      : '0 ms · Local'}
              </Text>
            </Pressable>

            {/* Píldora de Cuenta / Perfil */}
            <Pressable
              onPress={openAccountSheet}
              style={[
                styles.accountPill,
                {
                  backgroundColor: theme.card,
                  borderColor: isAuthenticated
                    ? theme.glassBorderStrong
                    : theme.glassBorder,
                },
              ]}
              accessibilityLabel="Abrir cuenta y perfil"
            >
              {isAuthenticated ? (
                <View
                  style={[
                    styles.miniAvatar,
                    { backgroundColor: theme.accentPrimary },
                  ]}
                >
                  <Text
                    style={[
                      styles.miniAvatarText,
                      { color: theme.accentPrimaryText },
                    ]}
                  >
                    {userInitials}
                  </Text>
                </View>
              ) : (
                <User size={14} color={theme.textSecondary} strokeWidth={2} />
              )}
              <Text style={[styles.accountPillText, { color: theme.textPrimary }]}>
                {isAuthenticated ? firstName : 'Iniciar sesión'}
              </Text>
            </Pressable>

            {/* Toggle de tema en móvil */}
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
                  <Sun size={16} color={theme.textPrimary} strokeWidth={2} />
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
                { backgroundColor: theme.accentVolt },
                pressed && { opacity: 0.88 },
              ]}
            >
              <Plus size={16} color={theme.accentVoltText} strokeWidth={2.3} />
              <Text style={[styles.newCtaText, { color: theme.accentVoltText }]}>
                Nuevo
              </Text>
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
                <Text style={[styles.clearSearchText, { color: theme.accentPrimaryLink }]}>
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
                    <Bell size={14} color={theme.textSecondary} strokeWidth={2} />
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
                    onPress={() => {
                      if (h.habitType === 'quantitative') {
                        handleQuickHabitTap(h.id);
                      } else {
                        setDayPickerHabitId(h.id);
                      }
                    }}
                    style={[styles.searchHitRow, { borderColor: theme.divider }]}
                  >
                    <Flame size={14} color={theme.textSecondary} strokeWidth={2} />
                    <Text style={[styles.searchHitText, { color: theme.textPrimary }]} numberOfLines={1}>
                      {h.title}
                    </Text>
                    <Text style={[styles.searchHitTag, { color: theme.textSecondary }]}>
                      {h.computedStreak}d racha
                    </Text>
                  </Pressable>
                ))}
                {searchResults.blocks.map((b) => (
                  <Pressable
                    key={b.id}
                    onPress={() => router.push('/(tabs)/calendar')}
                    style={[styles.searchHitRow, { borderColor: theme.divider }]}
                  >
                    <Calendar size={14} color={theme.textSecondary} strokeWidth={2} />
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
                    <FileText size={14} color={theme.textSecondary} strokeWidth={2} />
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
                    backgroundColor: theme.pillBg,
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusLiveText,
                    { color: theme.textPrimary },
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
                    { backgroundColor: theme.accentPrimary },
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
                    { backgroundColor: theme.accentPrimaryBorder },
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
                    { backgroundColor: theme.textPrimary },
                  ]}
                />
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
                  Hábitos
                </Text>
                <Text style={[styles.kpiValue, { color: theme.textPrimary }]}>
                  {telemetry.completedHabits}/{telemetry.totalHabits}
                </Text>
                <Text style={[styles.kpiMeta, { color: theme.textSecondary }]}>
                  {telemetry.unlockedBadges}/{telemetry.totalBadges} insignias
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
                          { color: theme.textPrimary },
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

          {/* Mini Calendario Titanium Tonal */}
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
                  <Text style={[styles.inlineLinkText, { color: theme.accentPrimaryLink }]}>
                    Ver todo
                  </Text>
                  <ArrowRight size={13} color={theme.accentPrimaryLink} strokeWidth={2} />
                </Pressable>
              </View>

              <View style={styles.habitsSplitRow}>
                <View style={styles.habitsChecklistCol}>
                  {habits.slice(0, 4).map((habit) => {
                    const done = habit.completedOnActiveDate;
                    const isQuant = habit.habitType === 'quantitative';
                    const target = Math.max(1, habit.targetPerDay);
                    return (
                      <Pressable
                        key={habit.id}
                        onPress={() => {
                          if (isQuant) {
                            handleQuickHabitTap(habit.id);
                          } else {
                            setDayPickerHabitId(habit.id);
                          }
                        }}
                        style={[
                          styles.habitMiniRow,
                          {
                            backgroundColor: theme.cardElevated,
                            borderColor: done
                              ? theme.accentPrimaryBorder
                              : theme.glassBorder,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.habitCheckBox,
                            {
                              borderColor: done
                                ? theme.accentPrimary
                                : theme.textSecondary,
                              backgroundColor: done
                                ? theme.accentPrimary
                                : 'transparent',
                            },
                          ]}
                        >
                          {done ? (
                            <Check
                              size={12}
                              color={theme.accentPrimaryText}
                              strokeWidth={2.7}
                            />
                          ) : isQuant ? (
                            <Plus
                              size={11}
                              color={theme.accentPrimaryLink}
                              strokeWidth={2.5}
                            />
                          ) : null}
                        </View>
                        <Text
                          style={[
                            styles.habitMiniTitle,
                            { color: theme.textPrimary },
                            done &&
                              !isQuant && {
                                textDecorationLine: 'line-through',
                                color: theme.textMuted,
                              },
                          ]}
                          numberOfLines={1}
                        >
                          {habit.title}
                        </Text>
                        <Text style={[styles.habitMiniStreak, { color: theme.accentPrimaryLink }]}>
                          {isQuant
                            ? `${habit.activeCount}/${target}`
                            : habit.weeklyProgress.weeklyGoal
                              ? `${habit.weeklyProgress.completedThisWeek}/${habit.weeklyProgress.weeklyGoal} sem`
                              : `${habit.computedStreak}d`}
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

            {/* Insignias de Cumplimiento */}
            <LiquidGlassCard style={styles.bentoCard} contentStyle={styles.bentoCardContent}>
              {(() => {
                const nextBadge = telemetry.nextBadge;
                const NextBadgeIcon = nextBadge
                  ? resolveBadgeIcon(nextBadge.icon)
                  : Trophy;
                const progressPct = nextBadge ? nextBadge.progressPercent : 100;

                return (
                  <>
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.cardTitleWithBadge}>
                        <NextBadgeIcon
                          size={18}
                          color={theme.accentPrimaryLink}
                          strokeWidth={2}
                        />
                        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                          {nextBadge ? 'Próxima Insignia' : 'Insignias'}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => router.push('/(tabs)/habits')}
                        style={styles.inlineLink}
                      >
                        <Text style={[styles.inlineLinkText, { color: theme.accentPrimaryLink }]}>
                          Ver todas
                        </Text>
                        <ArrowRight size={13} color={theme.accentPrimaryLink} strokeWidth={2} />
                      </Pressable>
                    </View>

                    <Text style={[styles.rewardMetaTitle, { color: theme.textSecondary }]}>
                      {nextBadge
                        ? `${nextBadge.title} · ${nextBadge.description}`
                        : '¡Completaste todas las insignias disponibles!'}
                    </Text>

                    <View style={[styles.linearTrack, { backgroundColor: theme.pillBg }]}>
                      <View
                        style={[
                          styles.linearFill,
                          {
                            width: `${Math.max(6, progressPct)}%`,
                            backgroundColor: theme.accentPrimary,
                          },
                        ]}
                      />
                    </View>

                    <View style={styles.rewardBoundsRow}>
                      <Text style={[styles.rewardBoundText, { color: theme.textMuted }]}>
                        {nextBadge ? nextBadge.progressLabel : '100% completado'}
                      </Text>
                      <Text style={[styles.rewardBoundText, { color: theme.textPrimary }]}>
                        {telemetry.unlockedBadges}/{telemetry.totalBadges} logradas
                      </Text>
                    </View>

                    {/* Mini medallones */}
                    <View style={styles.miniBadgesRow}>
                      {badgesSummary.badges.slice(0, 6).map((b) => {
                        const BIcon = resolveBadgeIcon(b.icon);
                        return (
                          <Pressable
                            key={b.id}
                            onPress={() => router.push('/(tabs)/habits')}
                            style={[
                              styles.miniMedallion,
                              {
                                backgroundColor: b.unlocked
                                  ? theme.accentPrimarySoft
                                  : theme.pillBg,
                                borderColor: b.unlocked
                                  ? theme.accentPrimaryBorder
                                  : theme.glassBorder,
                              },
                            ]}
                            accessibilityLabel={b.title}
                          >
                            <BIcon
                              size={14}
                              color={
                                b.unlocked ? theme.accentPrimaryLink : theme.textMuted
                              }
                              strokeWidth={2}
                            />
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                );
              })()}
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

                    return (
                      <Pressable
                        key={tab.key}
                        onPress={() => setActivityFilter(tab.key)}
                        style={[
                          styles.segmentPill,
                          {
                            backgroundColor: active
                              ? theme.accentPrimary
                              : theme.pillBg,
                            borderColor: active
                              ? theme.accentPrimary
                              : theme.glassBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentPillText,
                            {
                              color: active
                                ? theme.accentPrimaryText
                                : theme.textSecondary,
                            },
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
                              backgroundColor: theme.cardElevated,
                              borderColor: isPrimary
                                ? theme.accentPrimaryBorder
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
                                    ? theme.accentPrimarySoft
                                    : theme.pillBg,
                                },
                              ]}
                            >
                              <Clock
                                size={12}
                                color={
                                  isPrimary
                                    ? theme.accentPrimaryLink
                                    : theme.textSecondary
                                }
                                strokeWidth={2}
                              />
                              <Text
                                style={[
                                  styles.activityBadgeText,
                                  {
                                    color: isPrimary
                                      ? theme.accentPrimaryLink
                                      : theme.textSecondary,
                                  },
                                ]}
                              >
                                {block.startTime} – {block.endTime}
                              </Text>
                            </View>
                            <ArrowUpRight
                              size={15}
                              color={theme.textMuted}
                              strokeWidth={2}
                            />
                          </View>

                          <Text
                            style={[
                              styles.activityTileTitle,
                              { color: theme.textPrimary },
                            ]}
                            numberOfLines={2}
                          >
                            {block.title}
                          </Text>
                          <Text
                            style={[
                              styles.activityTileMeta,
                              { color: theme.textSecondary },
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
                      const sourceNote = task.sourcePageId
                        ? notes.find((p) => p.id === task.sourcePageId)
                        : undefined;
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
                                color={theme.textSecondary}
                                strokeWidth={2}
                              />
                              <Text
                                style={[
                                  styles.priorityTag,
                                  {
                                    color:
                                      task.priority === 3
                                        ? theme.textPrimary
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
                                  { backgroundColor: theme.pillBg },
                                ]}
                              >
                                <Bell
                                  size={11}
                                  color={theme.textSecondary}
                                  strokeWidth={2}
                                />
                                <Text
                                  style={[
                                    styles.alertMiniText,
                                    { color: theme.textPrimary },
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

                          {sourceNote ? (
                            <Pressable
                              onPress={() =>
                                router.push({
                                  pathname: '/(tabs)/notes',
                                  params: { pageId: sourceNote.id },
                                })
                              }
                              style={styles.noteOriginLink}
                            >
                              <FileText size={11} color={theme.accentPrimaryLink} />
                              <Text
                                style={[
                                  styles.activityTileMeta,
                                  { color: theme.accentPrimaryLink },
                                ]}
                                numberOfLines={1}
                              >
                                Nota: {sourceNote.title}
                              </Text>
                            </Pressable>
                          ) : (
                            <Text
                              style={[
                                styles.activityTileMeta,
                                { color: theme.textSecondary },
                              ]}
                              numberOfLines={1}
                            >
                              {task.notes || 'Recordatorio activo'}
                            </Text>
                          )}
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
                        backgroundColor: theme.pillBg,
                        borderColor: theme.glassBorder,
                      },
                    ]}
                  >
                    <Plus size={13} color={theme.textPrimary} strokeWidth={2.3} />
                    <Text
                      style={[
                        styles.smallNewNoteText,
                        { color: theme.textPrimary },
                      ]}
                    >
                      Nueva Nota
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => router.push('/(tabs)/notes')}
                    style={styles.inlineLink}
                  >
                    <Text style={[styles.inlineLinkText, { color: theme.accentPrimaryLink }]}>
                      Abrir
                    </Text>
                    <ArrowRight size={13} color={theme.accentPrimaryLink} strokeWidth={2} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.notesList}>
                {notes.slice(0, 3).map((page) => {
                  const preview = stripMarkdownPreview(page.contentMarkdown);
                  const tagLabel = parseFirstTag(page.tags);
                  const NoteIcon = resolveNoteIcon(page.icon);
                  return (
                    <Pressable
                      key={page.id}
                      onPress={() =>
                        router.push({
                          pathname: '/(tabs)/notes',
                          params: { pageId: page.id },
                        })
                      }
                      style={({ pressed }) => [
                        styles.noteRowCard,
                        {
                          backgroundColor: theme.cardElevated,
                          borderColor: theme.glassBorder,
                        },
                        pressed && { opacity: 0.84 },
                      ]}
                    >
                      <View
                        style={[
                          styles.noteRowIconBox,
                          { backgroundColor: theme.pillBg },
                        ]}
                      >
                        <NoteIcon size={15} color={theme.accentPrimaryLink} />
                      </View>
                      <View style={styles.noteRowMain}>
                        <View style={styles.noteTitleRow}>
                          {page.isPinned ? (
                            <Pin
                              size={12}
                              color={theme.accentPrimaryLink}
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

              {/* Plantillas de 1 toque directamente desde Dashboard */}
              <View style={styles.quickTemplatesRow}>
                {(
                  [
                    { id: 'journaling_3min' as NoteTemplateId, label: 'Journaling 3m' },
                    { id: 'weekly_review' as NoteTemplateId, label: 'Revisión Sem.' },
                    { id: 'meeting_notes' as NoteTemplateId, label: 'Reunión' },
                  ] as const
                ).map((tpl) => (
                  <Pressable
                    key={tpl.id}
                    onPress={() => {
                      const data = instantiateNoteTemplate(tpl.id);
                      const created = insertNotePageOfflineFirst({
                        title: data.title,
                        icon: data.icon,
                        tags: data.tags,
                        blocksJson: JSON.stringify(data.blocks),
                        contentMarkdown: data.contentMarkdown,
                        userId: activeUserId,
                      });
                      router.push({
                        pathname: '/(tabs)/notes',
                        params: { pageId: created.id },
                      });
                    }}
                    style={({ pressed }) => [
                      styles.quickTemplateChip,
                      {
                        backgroundColor: theme.pillBg,
                        borderColor: theme.glassBorder,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Plus size={11} color={theme.accentPrimaryLink} strokeWidth={2.2} />
                    <Text
                      style={[
                        styles.quickTemplateText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {tpl.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </LiquidGlassCard>
          </View>
        </View>
      </ScrollView>

      <BinaryHabitDayPickerModal
        visible={Boolean(dayPickerHabit)}
        habit={dayPickerHabit}
        todayKey={todayKey}
        onClose={() => setDayPickerHabitId(null)}
        onToggleDate={toggleBinaryHabitForDate}
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
    gap: spacing.md,
  },
  greetingCol: {
    gap: 2,
  },
  greetingTitle: {
    fontSize: 26,
    ...typography.screenTitle,
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
  accountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 11,
    height: 38,
  },
  miniAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: {
    fontSize: 10,
    fontWeight: '800',
  },
  accountPillText: {
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
    ...typography.cardTitle,
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
    fontVariant: ['tabular-nums'],
    ...typography.kpiValue,
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
  miniBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
  },
  miniMedallion: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  noteOriginLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noteRowIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTemplatesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  quickTemplateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  quickTemplateText: {
    fontSize: 11,
    fontWeight: '600',
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
