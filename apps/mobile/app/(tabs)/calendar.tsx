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
  Briefcase,
  Calendar,
  MapPin,
  Plus,
  Trash2,
  Zap,
} from '../../src/components/icons';
import type { WorkBlockType } from '@organiza/shared/schema';
import { iconMetrics, radii, spacing, typography } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { LiquidGlassCard } from '../../src/components/glass/LiquidGlassCard';
import { MacIconBadge } from '../../src/components/glass/MacIconBadge';
import { useCalendarSchedule } from '../../src/features/calendar';
import { WeekDayLensPill } from '../../src/features/dashboard/CalendarDayCell';
import { getTodayDateKey } from '../../src/db/client';
import { authClient, resolveActiveUserId } from '../../src/services/authClient';

function buildWeekDays() {
  const base = new Date();
  const days: Array<{ dateKey: string; dayShort: string; dayNum: string }> = [];
  const shortNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  for (let offset = -1; offset <= 5; offset++) {
    const d = new Date(base);
    d.setDate(base.getDate() + offset);
    days.push({
      dateKey: getTodayDateKey(d),
      dayShort: shortNames[d.getDay()] ?? 'Día',
      dayNum: String(d.getDate()).padStart(2, '0'),
    });
  }
  return days;
}

export default function CalendarScheduleScreen() {
  const { theme } = useTheme();
  const { data: session } = authClient.useSession();
  const activeUserId = resolveActiveUserId(session?.user?.id);

  const {
    selectedDateKey,
    setSelectedDateKey,
    blocks,
    addWorkBlock,
    removeWorkBlock,
  } = useCalendarSchedule(getTodayDateKey(), activeUserId);

  const weekDays = useMemo(() => buildWeekDays(), []);
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('10:00');
  const [newEnd, setNewEnd] = useState('12:00');
  const [selectedType, setSelectedType] = useState<WorkBlockType>('deep_work');

  const calendarPalette = theme.modules.calendar;

  const handleAddBlock = () => {
    const clean = newTitle.trim();
    if (!clean) return;
    addWorkBlock({
      title: clean,
      blockType: selectedType,
      startTime: newStart.trim() || '09:00',
      endTime: newEnd.trim() || '11:00',
      locationOrLink:
        selectedType === 'deep_work'
          ? 'Bloque de concentración profunda'
          : 'Horario laboral programado',
      isRecurring: false,
    });
    setNewTitle('');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.canvas }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cabecera Fase 2: Calendario & Horarios */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <MacIconBadge
              icon={Calendar}
              module="calendar"
              containerSize={40}
              size={20}
            />
            <View>
              <Text style={[styles.phaseTag, { color: calendarPalette.icon }]}>
                FASE 2 • ESTILO macOS & TIME-BLOCKING
              </Text>
              <Text style={[styles.screenTitle, { color: theme.textPrimary }]}>
                Calendario & Horarios
              </Text>
            </View>
          </View>
        </View>

        {/* Selector Horizontal de Semana */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weekStrip}
        >
          {weekDays.map((day) => {
            const isSelected = day.dateKey === selectedDateKey;
            return (
              <WeekDayLensPill
                key={day.dateKey}
                dateKey={day.dateKey}
                dayShort={day.dayShort}
                dayNum={day.dayNum}
                isSelected={isSelected}
                onSelect={setSelectedDateKey}
                borderRadius={radii.md}
              />
            );
          })}
        </ScrollView>

        {/* Creador Rápido de Bloque Horario */}
        <LiquidGlassCard style={styles.creatorCard} contentStyle={styles.creatorContent}>
          <Text style={[styles.cardSectionTitle, { color: theme.textSecondary }]}>
            Nuevo Bloque de Horario / Trabajo
          </Text>

          <TextInput
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="Ej. Turno Mañana, Deep Work o Reunión..."
            placeholderTextColor={theme.textMuted}
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.glassBorder,
                color: theme.textPrimary,
              },
            ]}
          />

          <View style={styles.timeInputsRow}>
            <View style={styles.timeField}>
              <Text style={[styles.smallLabel, { color: theme.textSecondary }]}>Inicio</Text>
              <TextInput
                value={newStart}
                onChangeText={setNewStart}
                placeholder="09:00"
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.timeInput,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.glassBorder,
                    color: theme.textPrimary,
                  },
                ]}
              />
            </View>
            <View style={styles.timeField}>
              <Text style={[styles.smallLabel, { color: theme.textSecondary }]}>Fin</Text>
              <TextInput
                value={newEnd}
                onChangeText={setNewEnd}
                placeholder="11:00"
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.timeInput,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.glassBorder,
                    color: theme.textPrimary,
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.typeSelectorRow}>
            {(
              [
                { key: 'deep_work', label: 'Deep Work' },
                { key: 'work_shift', label: 'Turno Trabajo' },
                { key: 'personal', label: 'Personal' },
              ] as const
            ).map((t) => {
              const active = selectedType === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setSelectedType(t.key)}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: active
                        ? calendarPalette.background
                        : theme.inputBg,
                      borderColor: active
                        ? calendarPalette.border
                        : theme.glassBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      {
                        color: active ? calendarPalette.icon : theme.textSecondary,
                      },
                      active && { fontWeight: '700' },
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}

            <Pressable
              onPress={handleAddBlock}
              style={[styles.addBlockButton, { backgroundColor: theme.accentCobalt }]}
            >
              <Plus size={16} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.addBlockButtonText}>Agendar</Text>
            </Pressable>
          </View>
        </LiquidGlassCard>

        {/* Línea de Tiempo del Día */}
        <View style={styles.timelineSection}>
          <Text style={[styles.timelineHeader, { color: theme.textPrimary }]}>
            Cronograma · {blocks.length} bloques activos
          </Text>

          {blocks.map((block) => {
            const isDeepWork = block.blockType === 'deep_work';
            const badgePalette = isDeepWork
              ? theme.modules.calendar
              : theme.modules.dashboard;

            return (
              <LiquidGlassCard
                key={block.id}
                noPadding
                style={styles.blockCard}
                contentStyle={styles.blockRow}
              >
                <View style={styles.timeColumn}>
                  <Text style={[styles.startTimeText, { color: theme.textPrimary }]}>
                    {block.startTime}
                  </Text>
                  <Text style={[styles.endTimeText, { color: theme.textSecondary }]}>
                    {block.endTime}
                  </Text>
                </View>

                <View
                  style={[
                    styles.verticalAccentBar,
                    { backgroundColor: badgePalette.icon },
                  ]}
                />

                <View style={styles.blockMainInfo}>
                  <View style={styles.blockTypeBadgeRow}>
                    {isDeepWork ? (
                      <Zap size={12} color={badgePalette.icon} strokeWidth={2} />
                    ) : (
                      <Briefcase size={12} color={badgePalette.icon} strokeWidth={2} />
                    )}
                    <Text
                      style={[
                        styles.blockTypeLabel,
                        { color: badgePalette.icon },
                      ]}
                    >
                      {block.blockType === 'deep_work'
                        ? 'DEEP WORK'
                        : block.blockType === 'work_shift'
                          ? 'TURNO LABORAL'
                          : 'PERSONAL'}
                    </Text>
                  </View>

                  <Text style={[styles.blockTitle, { color: theme.textPrimary }]}>
                    {block.title}
                  </Text>

                  {block.locationOrLink ? (
                    <View style={styles.locationRow}>
                      <MapPin
                        size={12}
                        color={theme.textSecondary}
                        strokeWidth={iconMetrics.strokeWidth}
                      />
                      <Text style={[styles.locationText, { color: theme.textSecondary }]}>
                        {block.locationOrLink}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Pressable
                  onPress={() => removeWorkBlock(block.id)}
                  hitSlop={10}
                  style={styles.deleteBtn}
                >
                  <Trash2
                    size={16}
                    color={theme.textMuted}
                    strokeWidth={iconMetrics.strokeWidth}
                  />
                </Pressable>
              </LiquidGlassCard>
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  phaseTag: {
    fontSize: 10,
    ...typography.eyebrow,
  },
  screenTitle: {
    fontSize: 24,
    ...typography.screenTitle,
  },
  weekStrip: {
    gap: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 4,
    overflow: 'visible',
  },
  creatorCard: {
    borderRadius: radii.lg,
  },
  creatorContent: {
    gap: spacing.sm,
  },
  cardSectionTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    ...typography.eyebrow,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.squircle,
    paddingHorizontal: spacing.md,
    height: 42,
    fontSize: 14,
  },
  timeInputsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timeField: {
    flex: 1,
    gap: 4,
  },
  smallLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: radii.squircle,
    paddingHorizontal: spacing.md,
    height: 38,
    fontSize: 14,
    fontWeight: '600',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  addBlockButton: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  addBlockButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timelineSection: {
    gap: spacing.sm,
  },
  timelineHeader: {
    fontSize: 14,
    fontWeight: '700',
  },
  blockCard: {
    borderRadius: radii.md,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  timeColumn: {
    width: 48,
    alignItems: 'flex-end',
    gap: 2,
  },
  startTimeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  endTimeText: {
    fontSize: 12,
  },
  verticalAccentBar: {
    width: 3.5,
    height: '85%',
    borderRadius: radii.pill,
  },
  blockMainInfo: {
    flex: 1,
    gap: 3,
  },
  blockTypeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  blockTypeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
  },
  deleteBtn: {
    padding: 4,
  },
});
