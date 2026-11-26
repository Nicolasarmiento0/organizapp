import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NotePageRecord } from '@organiza/shared/schema';
import {
  ArrowRight,
  ChevronRight,
  DocumentAdd,
  Pin,
  Search,
  Sparkles,
  X,
} from '../../components/icons';
import { radii, shadows, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import { resolveNoteIcon } from './noteIcons';
import { buildSearchHits, type NoteSearchHit } from './noteTree';

export interface NoteSpotlightModalProps {
  visible: boolean;
  allPages: NotePageRecord[];
  searchPages: (query: string, limit?: number) => NotePageRecord[];
  onSelectPage: (pageId: string) => void;
  onCreateFromQuery: (title: string) => void;
  onClose: () => void;
}

export const NoteSpotlightModal: React.FC<NoteSpotlightModalProps> = ({
  visible,
  allPages,
  searchPages,
  onSelectPage,
  onCreateFromQuery,
  onClose,
}) => {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setHighlightIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible]);

  const matchedPages = useMemo(() => {
    return searchPages(query, 18);
  }, [query, searchPages, allPages]);

  const hits: NoteSearchHit[] = useMemo(() => {
    return buildSearchHits(allPages, matchedPages, query);
  }, [allPages, matchedPages, query]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query, hits.length]);

  const trimmedQuery = query.trim();
  const hasExactTitleMatch = useMemo(() => {
    if (!trimmedQuery) return true;
    const lower = trimmedQuery.toLowerCase();
    return allPages.some((p) => p.title.toLowerCase() === lower);
  }, [allPages, trimmedQuery]);

  const handleSelectHit = (pageId: string) => {
    onSelectPage(pageId);
    onClose();
  };

  // Navegación por teclado en Web (ArrowUp, ArrowDown, Enter, Escape)
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof window === 'undefined') {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightIndex((prev) =>
          hits.length > 0 ? (prev + 1) % hits.length : 0
        );
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightIndex((prev) =>
          hits.length > 0 ? (prev - 1 + hits.length) % hits.length : 0
        );
      } else if (event.key === 'Enter') {
        const selected = hits[highlightIndex];
        if (selected) {
          event.preventDefault();
          handleSelectHit(selected.page.id);
        } else if (trimmedQuery && !hasExactTitleMatch) {
          event.preventDefault();
          onCreateFromQuery(trimmedQuery);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    visible,
    hits,
    highlightIndex,
    trimmedQuery,
    hasExactTitleMatch,
    onClose,
    onCreateFromQuery,
  ]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={styles.modalWrap}
          onPress={(e) => e.stopPropagation()}
        >
          <LiquidGlassCard
            variant="floating"
            style={[styles.card, shadows.floatingDock]}
            contentStyle={styles.cardContent}
          >
            {/* Input Spotlight */}
            <View
              style={[
                styles.searchRow,
                { borderBottomColor: theme.divider },
              ]}
            >
              <Search size={18} color={theme.accentPrimaryLink} strokeWidth={2} />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar en títulos, contenido o etiquetas..."
                placeholderTextColor={theme.textMuted}
                style={[styles.searchInput, { color: theme.textPrimary }]}
                autoCorrect={false}
                returnKeyType="search"
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <X size={16} color={theme.textMuted} strokeWidth={2} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={onClose}
                style={[
                  styles.escPill,
                  { backgroundColor: theme.pillBg, borderColor: theme.glassBorder },
                ]}
              >
                <Text style={[styles.escText, { color: theme.textSecondary }]}>
                  {Platform.OS === 'web' ? 'ESC' : 'Cerrar'}
                </Text>
              </Pressable>
            </View>

            {/* Subheader FTS */}
            <View style={styles.metaBar}>
              <View style={styles.metaLeft}>
                <Sparkles size={12} color={theme.accentPrimaryLink} />
                <Text style={[styles.metaLabel, { color: theme.textMuted }]}>
                  {Platform.OS === 'web'
                    ? 'Índice Offline 0 ms'
                    : 'SQLite FTS5 Offline 0 ms'}
                </Text>
              </View>
              <Text style={[styles.metaCount, { color: theme.textMuted }]}>
                {hits.length} resultado{hits.length === 1 ? '' : 's'}
              </Text>
            </View>

            {/* Lista de Resultados */}
            <ScrollView
              style={styles.resultsScroll}
              contentContainerStyle={styles.resultsContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {hits.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                    Sin coincidencias para "{trimmedQuery}"
                  </Text>
                  <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                    Prueba con otra palabra clave o crea esta nota al instante.
                  </Text>
                </View>
              ) : (
                hits.map((hit, idx) => {
                  const IconComp = resolveNoteIcon(hit.page.icon);
                  const isFocused = idx === highlightIndex;

                  return (
                    <Pressable
                      key={hit.page.id}
                      onPress={() => handleSelectHit(hit.page.id)}
                      style={[
                        styles.hitRow,
                        {
                          backgroundColor: isFocused
                            ? theme.accentPrimarySoft
                            : theme.cardElevated,
                          borderColor: isFocused
                            ? theme.accentPrimaryBorder
                            : theme.glassBorder,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.hitIconBox,
                          {
                            backgroundColor: isFocused
                              ? theme.accentPrimarySoft
                              : theme.pillBg,
                          },
                        ]}
                      >
                        <IconComp
                          size={16}
                          color={
                            isFocused
                              ? theme.accentPrimaryLink
                              : theme.textSecondary
                          }
                        />
                      </View>

                      <View style={styles.hitTextCol}>
                        {hit.breadcrumb.length > 0 ? (
                          <View style={styles.hitBreadcrumbRow}>
                            {hit.breadcrumb.map((part, i) => (
                              <React.Fragment key={`${hit.page.id}_bc_${i}`}>
                                {i > 0 ? (
                                  <ChevronRight
                                    size={10}
                                    color={theme.textMuted}
                                    strokeWidth={2}
                                  />
                                ) : null}
                                <Text
                                  style={[
                                    styles.hitBreadcrumbText,
                                    { color: theme.textMuted },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {part}
                                </Text>
                              </React.Fragment>
                            ))}
                          </View>
                        ) : null}

                        <View style={styles.hitTitleRow}>
                          <Text
                            style={[
                              styles.hitTitle,
                              { color: theme.textPrimary },
                            ]}
                            numberOfLines={1}
                          >
                            {hit.page.title}
                          </Text>
                          {hit.page.isPinned ? (
                            <Pin size={12} color={theme.accentPrimaryLink} />
                          ) : null}
                        </View>

                        {hit.snippetParts ? (
                          <Text
                            style={[styles.hitSnippet, { color: theme.textSecondary }]}
                            numberOfLines={2}
                          >
                            {hit.snippetParts.before}
                            {hit.snippetParts.match ? (
                              <Text
                                style={[
                                  styles.hitMatchHighlight,
                                  {
                                    color: theme.accentPrimaryLink,
                                    backgroundColor: theme.accentPrimarySoft,
                                  },
                                ]}
                              >
                                {hit.snippetParts.match}
                              </Text>
                            ) : null}
                            {hit.snippetParts.after}
                          </Text>
                        ) : null}
                      </View>

                      <ArrowRight
                        size={14}
                        color={
                          isFocused ? theme.accentPrimaryLink : theme.textMuted
                        }
                        strokeWidth={2}
                      />
                    </Pressable>
                  );
                })
              )}

              {trimmedQuery.length > 0 && !hasExactTitleMatch ? (
                <Pressable
                  onPress={() => {
                    onCreateFromQuery(trimmedQuery);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.createQuickRow,
                    {
                      backgroundColor: theme.accentPrimarySoft,
                      borderColor: theme.accentPrimaryBorder,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <DocumentAdd size={16} color={theme.accentPrimaryLink} />
                  <Text
                    style={[
                      styles.createQuickText,
                      { color: theme.accentPrimaryLink },
                    ]}
                  >
                    Crear nueva nota "{trimmedQuery}"
                  </Text>
                </Pressable>
              ) : null}
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
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 72 : 56,
    paddingHorizontal: spacing.md,
  },
  modalWrap: {
    width: '100%',
    maxWidth: 640,
  },
  card: {
    borderRadius: radii.xl,
  },
  cardContent: {
    padding: 0,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  escPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  escText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaCount: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  resultsScroll: {
    maxHeight: 420,
  },
  resultsContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  emptyBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
  },
  hitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 11,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  hitIconBox: {
    width: 34,
    height: 34,
    borderRadius: radii.squircle,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hitTextCol: {
    flex: 1,
    gap: 2,
  },
  hitBreadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  hitBreadcrumbText: {
    fontSize: 10,
    fontWeight: '600',
    maxWidth: 140,
  },
  hitTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hitTitle: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  hitSnippet: {
    fontSize: 12,
    lineHeight: 17,
  },
  hitMatchHighlight: {
    fontWeight: '700',
  },
  createQuickRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  createQuickText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default NoteSpotlightModal;
