import React, { useEffect, useState } from 'react';
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
  FileText,
  Hash,
  Pin,
  Plus,
  Sparkles,
} from '../../src/components/icons';
import { iconMetrics, radii, spacing } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { LiquidGlassCard } from '../../src/components/glass/LiquidGlassCard';
import { MacIconBadge } from '../../src/components/glass/MacIconBadge';
import { useNotesWorkspace } from '../../src/features/notes';
import { authClient, resolveActiveUserId } from '../../src/services/authClient';

export default function NotesWorkspaceScreen() {
  const { theme } = useTheme();
  const { data: session } = authClient.useSession();
  const activeUserId = resolveActiveUserId(session?.user?.id);

  const {
    pages,
    activePage,
    setActivePageId,
    createPage,
    updatePageMarkdown,
    togglePinPage,
  } = useNotesWorkspace(activeUserId);

  const [draftTitle, setDraftTitle] = useState(activePage?.title ?? '');
  const [draftMarkdown, setDraftMarkdown] = useState(
    activePage?.contentMarkdown ?? ''
  );

  const notesPalette = theme.modules.notes;

  useEffect(() => {
    if (activePage) {
      setDraftTitle(activePage.title);
      setDraftMarkdown(activePage.contentMarkdown);
    }
  }, [activePage?.id]);

  const handleTitleChange = (nextTitle: string) => {
    setDraftTitle(nextTitle);
    if (activePage) {
      updatePageMarkdown(activePage.id, nextTitle, draftMarkdown);
    }
  };

  const handleMarkdownChange = (nextMarkdown: string) => {
    setDraftMarkdown(nextMarkdown);
    if (activePage) {
      updatePageMarkdown(activePage.id, draftTitle, nextMarkdown);
    }
  };

  const handleNewPage = () => {
    const created = createPage({
      title: 'Nueva Página Markdown',
      contentMarkdown: '# Nueva Página\n\nEscribe tus ideas o documentación en 0 ms...',
      tags: ['Workspace'],
      isPinned: false,
    });
    setDraftTitle(created.title);
    setDraftMarkdown(created.contentMarkdown);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.canvas }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cabecera Fase 5: Workspace tipo Notion + Bloc Markdown */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <MacIconBadge
              icon={FileText}
              module="notes"
              containerSize={40}
              size={20}
            />
            <View>
              <Text style={[styles.phaseTag, { color: notesPalette.icon }]}>
                FASE 5 • NOTION WORKSPACE & MARKDOWN
              </Text>
              <Text style={[styles.screenTitle, { color: theme.textPrimary }]}>
                Notas & Documentos
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleNewPage}
            style={[styles.newPageBtn, { backgroundColor: theme.accentCobalt }]}
          >
            <Plus size={16} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.newPageBtnText}>Nueva</Text>
          </Pressable>
        </View>

        {/* Selector Horizontal de Páginas */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pagesStrip}
        >
          {pages.map((page) => {
            const isSelected = page.id === activePage?.id;
            return (
              <Pressable
                key={page.id}
                onPress={() => setActivePageId(page.id)}
                style={[
                  styles.pageTab,
                  {
                    backgroundColor: isSelected
                      ? notesPalette.background
                      : theme.card,
                    borderColor: isSelected
                      ? notesPalette.border
                      : theme.glassBorder,
                  },
                ]}
              >
                {page.isPinned && (
                  <Pin
                    size={12}
                    color={isSelected ? notesPalette.icon : theme.textSecondary}
                    strokeWidth={2}
                  />
                )}
                <Text
                  style={[
                    styles.pageTabTitle,
                    { color: isSelected ? theme.textPrimary : theme.textSecondary },
                    isSelected && { fontWeight: '700' },
                  ]}
                  numberOfLines={1}
                >
                  {page.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Lienzo Editor Markdown en Vivo */}
        {activePage ? (
          <LiquidGlassCard style={styles.editorCard} contentStyle={styles.editorContent}>
            <View style={styles.editorToolbar}>
              <View
                style={[
                  styles.statusChip,
                  { backgroundColor: notesPalette.background },
                ]}
              >
                <Sparkles
                  size={12}
                  color={notesPalette.icon}
                  strokeWidth={2}
                />
                <Text style={[styles.statusChipText, { color: notesPalette.icon }]}>
                  Autoguardado SQLite 0 ms
                </Text>
              </View>

              <Pressable
                onPress={() => togglePinPage(activePage.id)}
                style={[
                  styles.pinButton,
                  {
                    backgroundColor: activePage.isPinned
                      ? notesPalette.background
                      : theme.inputBg,
                    borderColor: activePage.isPinned
                      ? notesPalette.border
                      : theme.glassBorder,
                  },
                ]}
              >
                <Pin
                  size={13}
                  color={
                    activePage.isPinned ? notesPalette.icon : theme.textSecondary
                  }
                  strokeWidth={iconMetrics.strokeWidth}
                />
                <Text
                  style={[
                    styles.pinButtonText,
                    {
                      color: activePage.isPinned
                        ? notesPalette.icon
                        : theme.textSecondary,
                    },
                    activePage.isPinned && { fontWeight: '700' },
                  ]}
                >
                  {activePage.isPinned ? 'Fijada' : 'Fijar'}
                </Text>
              </Pressable>
            </View>

            <TextInput
              value={draftTitle}
              onChangeText={handleTitleChange}
              placeholder="Título de la página..."
              placeholderTextColor={theme.textMuted}
              style={[
                styles.pageTitleInput,
                {
                  color: theme.textPrimary,
                  borderBottomColor: theme.divider,
                },
              ]}
            />

            <View style={styles.markdownHelperRow}>
              <Hash size={12} color={theme.textMuted} strokeWidth={2} />
              <Text style={[styles.markdownHelperText, { color: theme.textMuted }]}>
                Soporta sintaxis Markdown (# Títulos, - Listas, **Negritas**, `Código`)
              </Text>
            </View>

            <TextInput
              value={draftMarkdown}
              onChangeText={handleMarkdownChange}
              placeholder="Escribe tus notas o bloques tipo Notion..."
              placeholderTextColor={theme.textMuted}
              style={[
                styles.markdownBodyInput,
                {
                  color: theme.textPrimary,
                  backgroundColor: theme.inputBg,
                  borderColor: theme.glassBorder,
                },
              ]}
              multiline
              textAlignVertical="top"
            />
          </LiquidGlassCard>
        ) : null}
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
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  newPageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  newPageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pagesStrip: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  pageTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 210,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: radii.squircle,
    borderWidth: 1,
  },
  pageTabTitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  editorCard: {
    borderRadius: radii.xl,
  },
  editorContent: {
    gap: spacing.md,
  },
  editorToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  pinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  pinButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  pageTitleInput: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.4,
    paddingVertical: 4,
    borderBottomWidth: 1,
  },
  markdownHelperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  markdownHelperText: {
    fontSize: 11,
  },
  markdownBodyInput: {
    minHeight: 340,
    fontSize: 15,
    lineHeight: 23,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
});
