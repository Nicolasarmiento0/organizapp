import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { TaskRecord } from '@organiza/shared/schema';
import {
  AlarmSleep,
  Bell,
  CheckCircle2,
  Flag,
  Plus,
  Search,
  X,
} from '../../src/components/icons';
import {
  iconMetrics,
  radii,
  shadows,
  spacing,
  typography,
} from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { LiquidGlassCard } from '../../src/components/glass/LiquidGlassCard';
import { MacIconBadge } from '../../src/components/glass/MacIconBadge';
import { authClient, resolveActiveUserId } from '../../src/services/authClient';
import {
  getWebPushSnapshot,
  sendTestWebPush,
  subscribeToWebPush,
  unsubscribeFromWebPush,
  type WebPushSnapshot,
} from '../../src/services/webPush';
import {
  IosPwaInstallBanner,
  ReminderEditorModal,
  ReminderRowCard,
  SmartListsGrid,
  SnoozeMenuModal,
  computeQuickPreset,
  groupScheduledTasks,
  isTaskInFlaggedSmartList,
  isTaskInTodaySmartList,
  useRemindersManager,
  type AllStatusFilter,
  type PriorityFilter,
  type QuickDatePreset,
  type ReminderEditorSavePayload,
  type SmartListKey,
  type SnoozePreset,
} from '../../src/features/reminders';

const QUICK_PRESETS: Array<{ key: QuickDatePreset; label: string }> = [
  { key: 'none', label: 'Sin aviso' },
  { key: '30m', label: '+30m' },
  { key: '1h', label: '+1h' },
  { key: 'today18', label: '18:00' },
  { key: 'tomorrow9', label: 'Mañ 9h' },
];

const SMART_LIST_HEADERS: Record<
  SmartListKey,
  { title: string; emptyText: string }
> = {
  today: {
    title: 'Hoy y Vencidos',
    emptyText: 'No tienes recordatorios pendientes para hoy.',
  },
  scheduled: {
    title: 'Agenda Cronológica',
    emptyText: 'No hay recordatorios programados por fecha u hora.',
  },
  all: {
    title: 'Todos los Recordatorios',
    emptyText: 'No hay recordatorios que coincidan con tus filtros.',
  },
  flagged: {
    title: 'Con Bandera y Urgentes',
    emptyText: 'No hay recordatorios urgentes o marcados con bandera.',
  },
};

export default function RemindersScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const activeUserId = resolveActiveUserId(session?.user?.id);

  const {
    todayKey,
    tasks,
    counts,
    createReminder,
    updateReminder,
    toggleComplete,
    toggleFlag,
    deleteReminder,
    snoozeReminder,
  } = useRemindersManager(activeUserId);

  const [activeList, setActiveList] = useState<SmartListKey>('today');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickPreset, setQuickPreset] = useState<QuickDatePreset>('30m');
  const [quickFlagged, setQuickFlagged] = useState(false);

  // Filtros exclusivos de la vista maestra "Todos"
  const [searchQuery, setSearchQuery] = useState('');
  const [allStatusFilter, setAllStatusFilter] =
    useState<AllStatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');

  // Editor modal (crear / editar) y menú Snooze rápido
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);
  const [snoozeTargetTask, setSnoozeTargetTask] = useState<TaskRecord | null>(
    null
  );
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Estado Web Push (PWA)
  const [pushSnapshot, setPushSnapshot] = useState<WebPushSnapshot | null>(
    null
  );
  const [pushBusy, setPushBusy] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      void getWebPushSnapshot().then(setPushSnapshot);
    }
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleToggleWebPush = async () => {
    if (Platform.OS !== 'web' || pushBusy) return;

    if (pushSnapshot?.status === 'ios_needs_install') {
      setShowIosGuide(true);
      showToast('Agrega la app a tu pantalla de inicio en Safari.');
      return;
    }

    setPushBusy(true);
    try {
      const next =
        pushSnapshot?.status === 'subscribed'
          ? await unsubscribeFromWebPush()
          : await subscribeToWebPush();
      setPushSnapshot(next);
      if (next.error) {
        showToast(next.error);
      } else if (next.status === 'subscribed') {
        showToast('Notificaciones Web Push activadas');
      } else {
        showToast('Notificaciones Web Push desactivadas');
      }
    } finally {
      setPushBusy(false);
    }
  };

  const handleTestWebPush = async () => {
    if (Platform.OS !== 'web' || pushBusy) return;
    setPushBusy(true);
    try {
      const res = await sendTestWebPush();
      if (res.ok) {
        showToast(`Notificación de prueba enviada (${res.sent})`);
      } else {
        showToast(res.error || 'No se pudo enviar la prueba push.');
      }
    } finally {
      setPushBusy(false);
    }
  };

  const showToast = (message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setFeedbackToast(message);
    toastTimerRef.current = setTimeout(() => {
      setFeedbackToast(null);
      toastTimerRef.current = null;
    }, 2600);
  };

  const handleSnoozePreset = (taskId: string, preset: SnoozePreset) => {
    const result = snoozeReminder(taskId, preset);
    if (result) {
      showToast(`Pospuesto para ${result.displayLabel}`);
    }
  };

  const nowMs = Date.now();

  const visibleTasks = useMemo(() => {
    if (activeList === 'today') {
      return tasks.filter((t) => isTaskInTodaySmartList(t, nowMs, todayKey));
    }
    if (activeList === 'flagged') {
      return tasks.filter((t) => isTaskInFlaggedSmartList(t));
    }
    if (activeList === 'all') {
      const q = searchQuery.trim().toLowerCase();
      return tasks.filter((t) => {
        if (allStatusFilter === 'pending' && t.isCompleted) return false;
        if (allStatusFilter === 'alerts' && (!t.reminderAt || t.isCompleted)) {
          return false;
        }
        if (allStatusFilter === 'completed' && !t.isCompleted) return false;
        if (priorityFilter !== 'all' && t.priority !== priorityFilter) {
          return false;
        }
        if (q) {
          const hay = `${t.title} ${t.notes ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
    }
    return [];
  }, [
    activeList,
    tasks,
    nowMs,
    todayKey,
    searchQuery,
    allStatusFilter,
    priorityFilter,
  ]);

  const scheduledGroups = useMemo(() => {
    if (activeList !== 'scheduled') return [];
    return groupScheduledTasks(tasks, todayKey, nowMs);
  }, [activeList, tasks, todayKey, nowMs]);

  const handleQuickCreate = () => {
    const clean = quickTitle.trim();
    if (!clean) return;

    const computed = computeQuickPreset(quickPreset);
    const shouldFlag = quickFlagged || activeList === 'flagged';
    const dueDate =
      computed.dueDate !== null
        ? computed.dueDate
        : activeList === 'today' || activeList === 'scheduled'
          ? todayKey
          : null;

    createReminder({
      title: clean,
      category: computed.reminderAt ? 'reminder' : 'today',
      priority: shouldFlag ? 3 : 2,
      isFlagged: shouldFlag,
      dueDate,
      reminderAt: computed.reminderAt,
    });

    setQuickTitle('');
    setQuickFlagged(false);
  };

  const openCreateModal = () => {
    setEditingTask(null);
    setEditorVisible(true);
  };

  const openEditModal = (task: TaskRecord) => {
    setEditingTask(task);
    setEditorVisible(true);
  };

  const handleSaveEditor = (payload: ReminderEditorSavePayload) => {
    if (editingTask) {
      updateReminder(editingTask.id, {
        title: payload.title,
        notes: payload.notes || null,
        priority: payload.priority,
        isFlagged: payload.isFlagged,
        dueDate: payload.dueDate,
        reminderAt: payload.reminderAt,
        category: payload.reminderAt ? 'reminder' : editingTask.category,
      });
    } else {
      createReminder({
        title: payload.title,
        notes: payload.notes,
        priority: payload.priority,
        isFlagged: payload.isFlagged,
        dueDate: payload.dueDate,
        reminderAt: payload.reminderAt,
        category: payload.reminderAt ? 'reminder' : 'today',
      });
    }
  };

  const renderReminderRow = (task: TaskRecord) => (
    <ReminderRowCard
      key={task.id}
      task={task}
      todayKey={todayKey}
      nowMs={nowMs}
      onToggleComplete={toggleComplete}
      onPressEdit={openEditModal}
      onOpenSnoozeMenu={(target) => setSnoozeTargetTask(target)}
      onQuickSnooze={handleSnoozePreset}
      onToggleFlag={toggleFlag}
      onDelete={deleteReminder}
      onOpenSourceNote={(pageId) =>
        router.push({
          pathname: '/(tabs)/notes',
          params: { pageId },
        })
      }
    />
  );

  const sectionHeader = SMART_LIST_HEADERS[activeList];

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.canvas }]}
      edges={['top']}
    >
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
              <Text style={[styles.overline, { color: theme.accentPrimaryLink }]}>
                AVISOS & RECORDATORIOS
              </Text>
              <Text style={[styles.screenTitle, { color: theme.textPrimary }]}>
                Recordatorios
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            {Platform.OS === 'web' && pushSnapshot?.status !== 'unsupported' ? (
              <Pressable
                onPress={() => void handleToggleWebPush()}
                disabled={pushBusy}
                style={[
                  styles.pushStatusPill,
                  {
                    backgroundColor:
                      pushSnapshot?.status === 'subscribed'
                        ? theme.accentPrimarySoft
                        : theme.card,
                    borderColor:
                      pushSnapshot?.status === 'subscribed'
                        ? theme.accentPrimaryBorder
                        : theme.glassBorder,
                  },
                  pushBusy && { opacity: 0.6 },
                ]}
              >
                <Bell
                  size={13}
                  color={
                    pushSnapshot?.status === 'subscribed'
                      ? theme.accentPrimaryLink
                      : theme.textSecondary
                  }
                  strokeWidth={2}
                />
                <Text
                  style={[
                    styles.summaryPillText,
                    {
                      color:
                        pushSnapshot?.status === 'subscribed'
                          ? theme.accentPrimaryLink
                          : theme.textSecondary,
                    },
                  ]}
                >
                  {pushBusy
                    ? 'Conectando...'
                    : pushSnapshot?.status === 'subscribed'
                      ? 'Push activo'
                      : pushSnapshot?.status === 'ios_needs_install'
                        ? 'Instalar PWA'
                        : pushSnapshot?.status === 'denied'
                          ? 'Push bloqueado'
                          : 'Activar Push'}
                </Text>
              </Pressable>
            ) : null}

            {Platform.OS === 'web' && pushSnapshot?.status === 'subscribed' ? (
              <Pressable
                onPress={() => void handleTestWebPush()}
                disabled={pushBusy}
                style={[
                  styles.pushStatusPill,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.glassBorder,
                  },
                  pushBusy && { opacity: 0.6 },
                ]}
              >
                <Text
                  style={[
                    styles.summaryPillText,
                    { color: theme.textSecondary },
                  ]}
                >
                  Probar
                </Text>
              </Pressable>
            ) : null}

            <View
              style={[
                styles.summaryPill,
                {
                  backgroundColor: theme.accentPrimarySoft,
                  borderColor: theme.accentPrimaryBorder,
                },
              ]}
            >
              <Bell size={13} color={theme.accentPrimaryLink} strokeWidth={2} />
              <Text
                style={[
                  styles.summaryPillText,
                  { color: theme.accentPrimaryLink },
                ]}
              >
                {counts.alerts} con aviso · {counts.allPending} pend.
              </Text>
            </View>

            <Pressable
              onPress={openCreateModal}
              style={({ pressed }) => [
                styles.newModalBtn,
                { backgroundColor: theme.accentPrimary },
                pressed && { opacity: 0.88 },
              ]}
            >
              <Plus
                size={15}
                color={theme.accentPrimaryText}
                strokeWidth={2.2}
              />
              <Text
                style={[
                  styles.newModalBtnText,
                  { color: theme.accentPrimaryText },
                ]}
              >
                Nuevo
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Banner iOS 16.4+ PWA Liquid Glass */}
        <IosPwaInstallBanner
          forceVisible={showIosGuide}
          onDismiss={() => setShowIosGuide(false)}
        />

        {/* Listas Inteligentes Superiores (Smart Lists 2x2 Liquid Glass) */}
        <SmartListsGrid
          activeList={activeList}
          onSelectList={setActiveList}
          counts={counts}
        />

        {/* Captura rápida inline */}
        <LiquidGlassCard variant="solid" noPadding style={styles.quickCard}>
          <View style={styles.quickRow}>
            <TextInput
              value={quickTitle}
              onChangeText={setQuickTitle}
              placeholder="Nuevo recordatorio o aviso rápido..."
              placeholderTextColor={theme.textMuted}
              style={[styles.quickInput, { color: theme.textPrimary }]}
              returnKeyType="done"
              onSubmitEditing={handleQuickCreate}
            />

            <Pressable
              onPress={() => setQuickFlagged((prev) => !prev)}
              hitSlop={6}
              style={[
                styles.flagToggleBtn,
                {
                  backgroundColor: quickFlagged
                    ? theme.accentPrimarySoft
                    : theme.pillBg,
                  borderColor: quickFlagged
                    ? theme.accentPrimaryBorder
                    : theme.glassBorder,
                },
              ]}
            >
              <Flag
                size={14}
                color={
                  quickFlagged ? theme.accentPrimaryLink : theme.textSecondary
                }
                strokeWidth={iconMetrics.strokeWidth}
              />
            </Pressable>

            <Pressable
              onPress={handleQuickCreate}
              style={[
                styles.addBtn,
                { backgroundColor: theme.accentPrimary },
                !quickTitle.trim() && { opacity: 0.45 },
              ]}
            >
              <Plus
                size={18}
                color={theme.accentPrimaryText}
                strokeWidth={2.2}
              />
            </Pressable>
          </View>

          <View
            style={[
              styles.quickPresetsRow,
              { borderTopColor: theme.divider },
            ]}
          >
            {QUICK_PRESETS.map((p) => {
              const active = quickPreset === p.key;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => setQuickPreset(p.key)}
                  style={[
                    styles.quickPresetPill,
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
                      styles.quickPresetText,
                      {
                        color: active
                          ? theme.accentPrimaryLink
                          : theme.textSecondary,
                      },
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </LiquidGlassCard>

        {/* Controles de la vista maestra "Todos" */}
        {activeList === 'all' ? (
          <View style={styles.masterFiltersBlock}>
            <View
              style={[
                styles.searchBar,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.glassBorder,
                },
              ]}
            >
              <Search size={15} color={theme.textMuted} strokeWidth={1.8} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar por título o notas..."
                placeholderTextColor={theme.textMuted}
                style={[styles.searchInput, { color: theme.textPrimary }]}
              />
              {searchQuery ? (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <X size={15} color={theme.textMuted} strokeWidth={2} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.filtersRow}>
              {(
                [
                  { key: 'all', label: 'Todos' },
                  { key: 'pending', label: 'Pendientes' },
                  { key: 'alerts', label: 'Con Aviso' },
                  { key: 'completed', label: 'Completados' },
                ] as const
              ).map((f) => {
                const active = allStatusFilter === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setAllStatusFilter(f.key)}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: active
                          ? theme.accentPrimary
                          : theme.card,
                        borderColor: active
                          ? theme.accentPrimary
                          : theme.glassBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        {
                          color: active
                            ? theme.accentPrimaryText
                            : theme.textSecondary,
                        },
                      ]}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}

              {(
                [
                  { key: 'all', label: 'P: Todas' },
                  { key: 3, label: 'Alta' },
                  { key: 2, label: 'Media' },
                  { key: 1, label: 'Baja' },
                ] as const
              ).map((pf) => {
                const active = priorityFilter === pf.key;
                return (
                  <Pressable
                    key={String(pf.key)}
                    onPress={() => setPriorityFilter(pf.key)}
                    style={[
                      styles.filterPill,
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
                        styles.filterText,
                        {
                          color: active
                            ? theme.accentPrimaryLink
                            : theme.textSecondary,
                        },
                      ]}
                    >
                      {pf.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Encabezado contextual de la lista activa */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              {sectionHeader.title}
            </Text>
            <Text style={[styles.sectionHint, { color: theme.textMuted }]}>
              Desliza a la izquierda o toca el reloj para posponer
            </Text>
          </View>
          <Text style={[styles.sectionCount, { color: theme.textSecondary }]}>
            {activeList === 'scheduled'
              ? `${counts.scheduled} prog.`
              : `${visibleTasks.length} ítems`}
          </Text>
        </View>

        {/* Contenido principal: Cronológico o Lista */}
        {activeList === 'scheduled' ? (
          scheduledGroups.length === 0 ? (
            <LiquidGlassCard style={styles.emptyCard}>
              <CheckCircle2
                size={26}
                color={theme.textMuted}
                strokeWidth={iconMetrics.strokeWidth}
              />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {sectionHeader.emptyText}
              </Text>
            </LiquidGlassCard>
          ) : (
            <View style={styles.groupsStack}>
              {scheduledGroups.map((group) => (
                <View key={group.id} style={styles.groupBlock}>
                  <View style={styles.groupHeaderRow}>
                    <View style={styles.groupTitleLeft}>
                      <Text
                        style={[
                          styles.groupTitle,
                          {
                            color: group.isOverdue
                              ? theme.accentPrimaryLink
                              : theme.textPrimary,
                          },
                        ]}
                      >
                        {group.title}
                      </Text>
                      <Text
                        style={[
                          styles.groupSubtitle,
                          { color: theme.textMuted },
                        ]}
                      >
                        · {group.subtitle}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.groupCountPill,
                        {
                          backgroundColor: group.isOverdue
                            ? theme.accentPrimarySoft
                            : theme.pillBg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.groupCountText,
                          {
                            color: group.isOverdue
                              ? theme.accentPrimaryLink
                              : theme.textSecondary,
                          },
                        ]}
                      >
                        {group.items.length}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.listStack}>
                    {group.items.map(renderReminderRow)}
                  </View>
                </View>
              ))}
            </View>
          )
        ) : (
          <View style={styles.listStack}>
            {visibleTasks.length === 0 ? (
              <LiquidGlassCard style={styles.emptyCard}>
                <CheckCircle2
                  size={26}
                  color={theme.textMuted}
                  strokeWidth={iconMetrics.strokeWidth}
                />
                <Text
                  style={[styles.emptyText, { color: theme.textSecondary }]}
                >
                  {sectionHeader.emptyText}
                </Text>
              </LiquidGlassCard>
            ) : (
              visibleTasks.map(renderReminderRow)
            )}
          </View>
        )}
      </ScrollView>

      <ReminderEditorModal
        visible={editorVisible}
        task={editingTask}
        defaultFlagged={activeList === 'flagged'}
        defaultDueDate={activeList === 'today' ? todayKey : null}
        onClose={() => {
          setEditorVisible(false);
          setEditingTask(null);
        }}
        onSave={handleSaveEditor}
        onDelete={deleteReminder}
      />

      <SnoozeMenuModal
        visible={Boolean(snoozeTargetTask)}
        task={snoozeTargetTask}
        onClose={() => setSnoozeTargetTask(null)}
        onSelectPreset={handleSnoozePreset}
        onOpenCustomEditor={(target) => {
          setSnoozeTargetTask(null);
          openEditModal(target);
        }}
      />

      {feedbackToast ? (
        <View pointerEvents="none" style={styles.toastWrapper}>
          <LiquidGlassCard
            variant="floating"
            intensity={85}
            noPadding
            style={[
              styles.toastPill,
              { borderColor: theme.accentPrimaryBorder },
            ]}
            contentStyle={styles.toastContent}
          >
            <AlarmSleep
              size={15}
              color={theme.accentPrimaryLink}
              strokeWidth={iconMetrics.strokeWidth}
            />
            <Text style={[styles.toastText, { color: theme.textPrimary }]}>
              {feedbackToast}
            </Text>
          </LiquidGlassCard>
        </View>
      ) : null}
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
  headerRight: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pushStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  overline: {
    fontSize: 10,
    ...typography.eyebrow,
  },
  screenTitle: {
    fontSize: 24,
    ...typography.screenTitle,
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
    ...typography.bodySemiBold,
  },
  newModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  newModalBtnText: {
    fontSize: 12,
    ...typography.bodySemiBold,
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
    ...typography.bodyMedium,
  },
  flagToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  quickPresetPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  quickPresetText: {
    fontSize: 11,
    ...typography.label,
  },
  masterFiltersBlock: {
    gap: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    ...typography.body,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 12,
    ...typography.label,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -spacing.xs,
  },
  sectionTitle: {
    fontSize: 15,
    ...typography.heading3,
  },
  sectionHint: {
    fontSize: 11,
    marginTop: 1,
    ...typography.caption,
  },
  sectionCount: {
    fontSize: 12,
    ...typography.caption,
  },
  groupsStack: {
    gap: spacing.lg,
  },
  groupBlock: {
    gap: spacing.sm,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupTitleLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  groupTitle: {
    fontSize: 14,
    ...typography.cardTitle,
  },
  groupSubtitle: {
    fontSize: 12,
    ...typography.caption,
  },
  groupCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  groupCountText: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    ...typography.bodySemiBold,
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
    textAlign: 'center',
    ...typography.body,
  },
  toastWrapper: {
    position: 'absolute',
    bottom: 92,
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
  },
  toastPill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    ...shadows.floatingDock,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toastText: {
    fontSize: 13,
    ...typography.bodySemiBold,
  },
});
