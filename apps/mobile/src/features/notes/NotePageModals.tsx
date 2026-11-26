import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NotePageRecord } from '@organiza/shared/schema';
import {
  Folder,
  RotateCcw,
  Trash2,
  X,
} from '../../components/icons';
import { radii, shadows, spacing, typography } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import { NOTE_ICON_OPTIONS, resolveNoteIcon } from './noteIcons';
import {
  buildNoteTree,
  flattenNoteTree,
  getDescendantIds,
} from './noteTree';

export interface NoteIconPickerModalProps {
  visible: boolean;
  currentIcon: string;
  onSelectIcon: (iconName: string) => void;
  onClose: () => void;
}

export const NoteIconPickerModal: React.FC<NoteIconPickerModalProps> = ({
  visible,
  currentIcon,
  onSelectIcon,
  onClose,
}) => {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheetWrap} onPress={(e) => e.stopPropagation()}>
          <LiquidGlassCard variant="floating" style={[styles.card, shadows.floatingDock]}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                Icono de la página
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <X size={18} color={theme.textSecondary} strokeWidth={2} />
              </Pressable>
            </View>

            <View style={styles.iconGrid}>
              {NOTE_ICON_OPTIONS.map((opt) => {
                const IconComp = opt.icon;
                const active = opt.name === currentIcon;
                return (
                  <Pressable
                    key={opt.name}
                    onPress={() => {
                      onSelectIcon(opt.name);
                      onClose();
                    }}
                    style={[
                      styles.iconTile,
                      {
                        backgroundColor: active
                          ? theme.accentPrimarySoft
                          : theme.cardElevated,
                        borderColor: active
                          ? theme.accentPrimaryBorder
                          : theme.glassBorder,
                      },
                    ]}
                  >
                    <IconComp
                      size={20}
                      color={active ? theme.accentPrimaryLink : theme.textPrimary}
                    />
                    <Text
                      style={[
                        styles.iconLabel,
                        {
                          color: active
                            ? theme.accentPrimaryLink
                            : theme.textSecondary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </LiquidGlassCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export interface NoteMoveModalProps {
  visible: boolean;
  page: NotePageRecord | null;
  allPages: NotePageRecord[];
  onMove: (newParentId: string | null) => void;
  onClose: () => void;
}

export const NoteMoveModal: React.FC<NoteMoveModalProps> = ({
  visible,
  page,
  allPages,
  onMove,
  onClose,
}) => {
  const { theme } = useTheme();

  const destinations = useMemo(() => {
    if (!page) return [];
    const blocked = getDescendantIds(allPages, page.id);
    const flat = flattenNoteTree(buildNoteTree(allPages));
    return flat.filter((entry) => !blocked.has(entry.page.id));
  }, [allPages, page]);

  if (!page) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheetWrap} onPress={(e) => e.stopPropagation()}>
          <LiquidGlassCard variant="floating" style={[styles.card, shadows.floatingDock]}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: theme.textPrimary }]}>
                  Mover página
                </Text>
                <Text
                  style={[styles.subtitle, { color: theme.textMuted }]}
                  numberOfLines={1}
                >
                  Elige la ubicación de "{page.title}"
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <X size={18} color={theme.textSecondary} strokeWidth={2} />
              </Pressable>
            </View>

            <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
              <Pressable
                onPress={() => {
                  onMove(null);
                  onClose();
                }}
                style={[
                  styles.destRow,
                  {
                    backgroundColor:
                      page.parentId === null
                        ? theme.accentPrimarySoft
                        : theme.cardElevated,
                    borderColor:
                      page.parentId === null
                        ? theme.accentPrimaryBorder
                        : theme.glassBorder,
                  },
                ]}
              >
                <Folder
                  size={16}
                  color={
                    page.parentId === null
                      ? theme.accentPrimaryLink
                      : theme.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.destTitle,
                    {
                      color:
                        page.parentId === null
                          ? theme.accentPrimaryLink
                          : theme.textPrimary,
                    },
                  ]}
                >
                  Raíz del Workspace (Nivel superior)
                </Text>
              </Pressable>

              {destinations.map(({ page: dest, depth }) => {
                const IconComp = resolveNoteIcon(dest.icon);
                const isCurrentParent = page.parentId === dest.id;
                return (
                  <Pressable
                    key={dest.id}
                    onPress={() => {
                      onMove(dest.id);
                      onClose();
                    }}
                    style={[
                      styles.destRow,
                      {
                        marginLeft: Math.min(depth, 4) * 12,
                        backgroundColor: isCurrentParent
                          ? theme.accentPrimarySoft
                          : theme.cardElevated,
                        borderColor: isCurrentParent
                          ? theme.accentPrimaryBorder
                          : theme.glassBorder,
                      },
                    ]}
                  >
                    <IconComp
                      size={15}
                      color={
                        isCurrentParent
                          ? theme.accentPrimaryLink
                          : theme.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.destTitle,
                        {
                          color: isCurrentParent
                            ? theme.accentPrimaryLink
                            : theme.textPrimary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {dest.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </LiquidGlassCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export interface NoteTrashModalProps {
  visible: boolean;
  deletedPages: NotePageRecord[];
  onRestore: (pageId: string) => void;
  onClose: () => void;
}

export const NoteTrashModal: React.FC<NoteTrashModalProps> = ({
  visible,
  deletedPages,
  onRestore,
  onClose,
}) => {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheetWrap} onPress={(e) => e.stopPropagation()}>
          <LiquidGlassCard variant="floating" style={[styles.card, shadows.floatingDock]}>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <Trash2 size={18} color={theme.accentPrimaryLink} />
                <View>
                  <Text style={[styles.title, { color: theme.textPrimary }]}>
                    Papelera de Notas
                  </Text>
                  <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                    Recupera páginas eliminadas en 1 toque
                  </Text>
                </View>
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <X size={18} color={theme.textSecondary} strokeWidth={2} />
              </Pressable>
            </View>

            <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
              {deletedPages.length === 0 ? (
                <Text style={[styles.emptyTrash, { color: theme.textMuted }]}>
                  La papelera está vacía.
                </Text>
              ) : (
                deletedPages.map((item) => {
                  const IconComp = resolveNoteIcon(item.icon);
                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.trashRow,
                        {
                          backgroundColor: theme.cardElevated,
                          borderColor: theme.glassBorder,
                        },
                      ]}
                    >
                      <IconComp size={16} color={theme.textSecondary} />
                      <Text
                        style={[styles.destTitle, { color: theme.textPrimary }]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Pressable
                        onPress={() => onRestore(item.id)}
                        style={[
                          styles.restoreBtn,
                          {
                            backgroundColor: theme.accentPrimarySoft,
                            borderColor: theme.accentPrimaryBorder,
                          },
                        ]}
                      >
                        <RotateCcw
                          size={13}
                          color={theme.accentPrimaryLink}
                          strokeWidth={2}
                        />
                        <Text
                          style={[
                            styles.restoreText,
                            { color: theme.accentPrimaryLink },
                          ]}
                        >
                          Restaurar
                        </Text>
                      </Pressable>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </LiquidGlassCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  sheetWrap: {
    width: '100%',
    maxWidth: 460,
  },
  card: {
    borderRadius: radii.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  title: {
    fontSize: 17,
    ...typography.cardTitle,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  iconTile: {
    width: '23.4%',
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 5,
  },
  iconLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  listScroll: {
    maxHeight: 340,
  },
  listContent: {
    gap: spacing.xs,
  },
  destRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  destTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  trashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  restoreText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyTrash: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
