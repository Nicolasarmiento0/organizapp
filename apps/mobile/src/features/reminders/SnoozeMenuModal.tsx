import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { TaskRecord } from '@organiza/shared/schema';
import {
  AlarmSleep,
  CalendarClock,
  Clock,
  Sun,
  X,
  type AppIcon,
} from '../../components/icons';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import { iconMetrics, radii, shadows, spacing, typography } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import {
  SNOOZE_OPTIONS,
  getSnoozeOptionPreview,
  type SnoozePreset,
} from './reminderUtils';

export interface SnoozeMenuModalProps {
  visible: boolean;
  task: TaskRecord | null;
  onClose: () => void;
  onSelectPreset: (taskId: string, preset: SnoozePreset) => void;
  onOpenCustomEditor?: (task: TaskRecord) => void;
}

const OPTION_ICONS: Record<SnoozePreset, AppIcon> = {
  '1h': Clock,
  this_evening: Sun,
  tomorrow_9am: CalendarClock,
};

export const SnoozeMenuModal: React.FC<SnoozeMenuModalProps> = ({
  visible,
  task,
  onClose,
  onSelectPreset,
  onOpenCustomEditor,
}) => {
  const { theme, isDark } = useTheme();

  if (!task) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.backdrop,
          {
            backgroundColor: isDark
              ? 'rgba(5, 7, 10, 0.72)'
              : 'rgba(15, 17, 21, 0.28)',
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <LiquidGlassCard
          variant="floating"
          intensity={85}
          style={styles.sheetContainer}
          contentStyle={styles.sheetContent}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.headerBadge,
                  {
                    backgroundColor: theme.accentPrimarySoft,
                    borderColor: theme.accentPrimaryBorder,
                  },
                ]}
              >
                <AlarmSleep
                  size={18}
                  color={theme.accentPrimaryLink}
                  strokeWidth={iconMetrics.strokeWidth}
                />
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>
                  Posponer en 1 toque
                </Text>
                <Text
                  style={[styles.sheetSubtitle, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  {task.title}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: theme.pillBg }]}
              hitSlop={10}
            >
              <X
                size={17}
                color={theme.textSecondary}
                strokeWidth={iconMetrics.strokeWidth}
              />
            </Pressable>
          </View>

          <View style={styles.optionsList}>
            {SNOOZE_OPTIONS.map((option) => {
              const IconComp = OPTION_ICONS[option.key];
              const previewLabel = getSnoozeOptionPreview(option.key);

              return (
                <Pressable
                  key={option.key}
                  onPress={() => {
                    onSelectPreset(task.id, option.key);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.optionRow,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.glassBorder,
                    },
                    pressed && {
                      backgroundColor: theme.accentPrimarySoft,
                      borderColor: theme.accentPrimaryBorder,
                      transform: [{ scale: 0.99 }],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.optionIconPill,
                      { backgroundColor: theme.accentPrimarySoft },
                    ]}
                  >
                    <IconComp
                      size={16}
                      color={theme.accentPrimaryLink}
                      strokeWidth={iconMetrics.strokeWidth}
                    />
                  </View>

                  <Text
                    style={[styles.optionTitle, { color: theme.textPrimary }]}
                  >
                    {option.title}
                  </Text>

                  <View
                    style={[
                      styles.previewBadge,
                      {
                        backgroundColor: theme.accentPrimarySoft,
                        borderColor: theme.accentPrimaryBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.previewText,
                        { color: theme.accentPrimaryLink },
                      ]}
                    >
                      {previewLabel}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {onOpenCustomEditor ? (
            <Pressable
              onPress={() => {
                onClose();
                onOpenCustomEditor(task);
              }}
              style={[
                styles.customEditorBtn,
                {
                  backgroundColor: theme.pillBg,
                  borderColor: theme.glassBorder,
                },
              ]}
            >
              <CalendarClock
                size={14}
                color={theme.textSecondary}
                strokeWidth={iconMetrics.strokeWidth}
              />
              <Text
                style={[styles.customEditorText, { color: theme.textSecondary }]}
              >
                Personalizar fecha y hora...
              </Text>
            </Pressable>
          ) : null}
        </LiquidGlassCard>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    paddingHorizontal: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl : spacing.lg,
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    borderRadius: radii.xl,
    ...shadows.modal,
  },
  sheetContent: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerBadge: {
    width: 38,
    height: 38,
    borderRadius: radii.squircle,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: 16,
    ...typography.cardTitle,
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
    ...typography.caption,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsList: {
    gap: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  optionIconPill: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    flex: 1,
    fontSize: 14,
    ...typography.bodySemiBold,
  },
  previewBadge: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  previewText: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    ...typography.bodySemiBold,
  },
  customEditorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: 2,
  },
  customEditorText: {
    fontSize: 13,
    ...typography.label,
  },
});

export default SnoozeMenuModal;
