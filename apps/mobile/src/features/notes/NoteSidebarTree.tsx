import React, { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NotePageRecord } from '@organiza/shared/schema';
import {
  ChevronDown,
  ChevronRight,
  Pin,
  Plus,
  Search,
  Trash2,
} from '../../components/icons';
import { radii, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { resolveNoteIcon } from './noteIcons';
import { getBreadcrumbTrail, type NoteTreeNode } from './noteTree';

export interface NoteSidebarTreeProps {
  pages: NotePageRecord[];
  pinnedPages: NotePageRecord[];
  tree: NoteTreeNode[];
  activePageId: string | null;
  deletedCount: number;
  onSelectPage: (pageId: string) => void;
  onCreatePage: () => void;
  onCreateSubpage: (parentId: string) => void;
  onOpenSpotlight: () => void;
  onOpenTrash: () => void;
  compactHeader?: boolean;
}

export const NoteSidebarTree: React.FC<NoteSidebarTreeProps> = ({
  pages,
  pinnedPages,
  tree,
  activePageId,
  deletedCount,
  onSelectPage,
  onCreatePage,
  onCreateSubpage,
  onOpenSpotlight,
  onOpenTrash,
  compactHeader = false,
}) => {
  const { theme } = useTheme();
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Auto-expande todos los ancestros de la página activa al navegar
  useEffect(() => {
    if (!activePageId) return;
    const trail = getBreadcrumbTrail(pages, activePageId);
    if (trail.length <= 1) return;
    setExpandedIds((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const node of trail.slice(0, -1)) {
        if (!next[node.id]) {
          next[node.id] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activePageId, pages]);

  const toggleExpand = (pageId: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [pageId]: !(prev[pageId] ?? true),
    }));
  };

  const renderTreeNode = (node: NoteTreeNode): React.ReactNode => {
    const { page, depth, children } = node;
    const isActive = page.id === activePageId;
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds[page.id] ?? depth === 0;
    const IconComp = resolveNoteIcon(page.icon);
    const indent = Math.min(depth, 5) * 14;

    return (
      <View key={page.id}>
        <Pressable
          onPress={() => onSelectPage(page.id)}
          style={({ pressed }) => [
            styles.treeRow,
            {
              paddingLeft: 8 + indent,
              backgroundColor: isActive
                ? theme.accentPrimarySoft
                : pressed
                  ? theme.hoverBg
                  : 'transparent',
              borderColor: isActive ? theme.accentPrimaryBorder : 'transparent',
            },
          ]}
        >
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              if (hasChildren) toggleExpand(page.id);
            }}
            hitSlop={6}
            style={styles.chevronHit}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown
                  size={13}
                  color={isActive ? theme.accentPrimaryLink : theme.textMuted}
                  strokeWidth={2}
                />
              ) : (
                <ChevronRight
                  size={13}
                  color={isActive ? theme.accentPrimaryLink : theme.textMuted}
                  strokeWidth={2}
                />
              )
            ) : (
              <View style={[styles.leafDot, { backgroundColor: theme.divider }]} />
            )}
          </Pressable>

          <View style={styles.nodeIconWrap}>
            <IconComp
              size={15}
              color={isActive ? theme.accentPrimaryLink : theme.textSecondary}
            />
          </View>

          <Text
            style={[
              styles.nodeTitle,
              {
                color: isActive ? theme.textPrimary : theme.textSecondary,
                fontWeight: isActive ? '700' : '500',
              },
            ]}
            numberOfLines={1}
          >
            {page.title}
          </Text>

          {hasChildren && (
            <Text style={[styles.childCount, { color: theme.textMuted }]}>
              {children.length}
            </Text>
          )}

          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              setExpandedIds((prev) => ({ ...prev, [page.id]: true }));
              onCreateSubpage(page.id);
            }}
            hitSlop={6}
            accessibilityLabel={`Crear subpágina en ${page.title}`}
            style={({ pressed }) => [
              styles.addSubBtn,
              {
                backgroundColor: pressed ? theme.hoverBg : 'transparent',
              },
            ]}
          >
            <Plus size={13} color={theme.textMuted} strokeWidth={2} />
          </Pressable>
        </Pressable>

        {hasChildren && isExpanded ? (
          <View style={styles.childrenList}>
            {children.map((child) => renderTreeNode(child))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          borderColor: theme.glassBorder,
        },
      ]}
    >
      {/* Spotlight Search Trigger */}
      <Pressable
        onPress={onOpenSpotlight}
        style={({ pressed }) => [
          styles.searchTrigger,
          {
            backgroundColor: theme.inputBg,
            borderColor: theme.glassBorder,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Search size={14} color={theme.textMuted} strokeWidth={1.9} />
        <Text style={[styles.searchTriggerText, { color: theme.textMuted }]}>
          Buscar notas...
        </Text>
        {Platform.OS === 'web' ? (
          <View
            style={[
              styles.kbdBadge,
              { backgroundColor: theme.pillBg, borderColor: theme.glassBorder },
            ]}
          >
            <Text style={[styles.kbdText, { color: theme.textSecondary }]}>⌘K</Text>
          </View>
        ) : null}
      </Pressable>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollBody,
          compactHeader && { paddingBottom: spacing.md },
        ]}
      >
        {/* Fijadas */}
        {pinnedPages.length > 0 ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Pin size={12} color={theme.accentPrimaryLink} />
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                FIJADAS
              </Text>
            </View>
            <View style={styles.pinnedList}>
              {pinnedPages.map((page) => {
                const isActive = page.id === activePageId;
                const IconComp = resolveNoteIcon(page.icon);
                return (
                  <Pressable
                    key={`pin_${page.id}`}
                    onPress={() => onSelectPage(page.id)}
                    style={({ pressed }) => [
                      styles.pinnedRow,
                      {
                        backgroundColor: isActive
                          ? theme.accentPrimarySoft
                          : pressed
                            ? theme.hoverBg
                            : theme.cardElevated,
                        borderColor: isActive
                          ? theme.accentPrimaryBorder
                          : theme.glassBorder,
                      },
                    ]}
                  >
                    <IconComp
                      size={14}
                      color={isActive ? theme.accentPrimaryLink : theme.textPrimary}
                    />
                    <Text
                      style={[
                        styles.pinnedTitle,
                        { color: isActive ? theme.textPrimary : theme.textSecondary },
                        isActive && { fontWeight: '700' },
                      ]}
                      numberOfLines={1}
                    >
                      {page.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Árbol infinito del Workspace */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
              WORKSPACE ({pages.length})
            </Text>
            <Pressable
              onPress={onCreatePage}
              hitSlop={6}
              style={styles.inlineNewBtn}
            >
              <Plus size={13} color={theme.accentPrimaryLink} strokeWidth={2.2} />
              <Text style={[styles.inlineNewText, { color: theme.accentPrimaryLink }]}>
                Nueva
              </Text>
            </Pressable>
          </View>

          <View style={styles.treeList}>
            {tree.map((rootNode) => renderTreeNode(rootNode))}
          </View>
        </View>
      </ScrollView>

      {/* Footer: Nueva página & Papelera */}
      <View style={[styles.footerRow, { borderTopColor: theme.divider }]}>
        <Pressable
          onPress={onCreatePage}
          style={({ pressed }) => [
            styles.newRootBtn,
            {
              backgroundColor: theme.accentPrimary,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Plus size={15} color="#FFFFFF" strokeWidth={2.2} />
          <Text style={styles.newRootText}>Nueva página</Text>
        </Pressable>

        {deletedCount > 0 ? (
          <Pressable
            onPress={onOpenTrash}
            style={({ pressed }) => [
              styles.trashBtn,
              {
                backgroundColor: theme.pillBg,
                borderColor: theme.glassBorder,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Trash2 size={14} color={theme.textSecondary} />
            <Text style={[styles.trashCount, { color: theme.textSecondary }]}>
              {deletedCount}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  searchTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  searchTriggerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  kbdBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  kbdText: {
    fontSize: 10,
    fontWeight: '700',
  },
  scrollBody: {
    gap: spacing.md,
    paddingVertical: 4,
  },
  sectionBlock: {
    gap: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  inlineNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  inlineNewText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pinnedList: {
    gap: 4,
  },
  pinnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  pinnedTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  treeList: {
    gap: 2,
  },
  childrenList: {
    gap: 2,
  },
  treeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingRight: 6,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  chevronHit: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leafDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  nodeIconWrap: {
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeTitle: {
    flex: 1,
    fontSize: 13,
  },
  childCount: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    paddingHorizontal: 4,
  },
  addSubBtn: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  newRootBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radii.md,
  },
  newRootText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  trashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  trashCount: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});

export default NoteSidebarTree;
