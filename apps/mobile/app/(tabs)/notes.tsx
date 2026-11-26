import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Check,
  ChevronRight,
  Copy,
  DocumentAdd,
  FileText,
  FolderOpen,
  Hash,
  ListCheck,
  Maximize2,
  Minimize2,
  MoveRight,
  PanelLeft,
  Pin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from '../../src/components/icons';
import { fontFamilies, radii, spacing, typography } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { LiquidGlassCard } from '../../src/components/glass/LiquidGlassCard';
import { MacIconBadge } from '../../src/components/glass/MacIconBadge';
import { copyTextToClipboard } from '../../src/utils/clipboard';
import {
  compressWebImageFile,
  uploadCompressedImageToR2,
} from '../../src/services/mediaUpload';
import {
  computeChecklistProgress,
  computeNoteMetrics,
  createBlock,
  getDirectChildren,
  loadBlocksForPage,
  NoteBlockEditor,
  NoteIconPickerModal,
  NoteMoveModal,
  NoteSidebarTree,
  NoteSpotlightModal,
  NoteTemplatesModal,
  NoteTrashModal,
  resolveNoteIcon,
  serializeBlocksToMarkdown,
  useNotesWorkspace,
  type NoteBlock,
  type NoteTemplateId,
} from '../../src/features/notes';
import { authClient, resolveActiveUserId } from '../../src/services/authClient';

export default function NotesWorkspaceScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 860;
  const router = useRouter();
  const params = useLocalSearchParams<{ pageId?: string }>();
  const { theme, isDark } = useTheme();
  const { data: session } = authClient.useSession();
  const activeUserId = resolveActiveUserId(session?.user?.id);

  const {
    pages,
    deletedPages,
    pinnedPages,
    tree,
    activePage,
    activePageId,
    setActivePageId,
    breadcrumbs,
    activeSubpages,
    linkedTasksByBlockId,
    createPage,
    createSubpage,
    createFromTemplate,
    updatePage,
    updatePageBlocks,
    promoteBlockToTask,
    togglePinPage,
    duplicatePage,
    movePage,
    deletePage,
    restorePage,
    searchPages,
  } = useNotesWorkspace(activeUserId);

  const [draftTitle, setDraftTitle] = useState(activePage?.title ?? '');
  const [draftBlocks, setDraftBlocks] = useState<NoteBlock[]>(() =>
    activePage ? loadBlocksForPage(activePage) : [createBlock('paragraph')]
  );

  const [sidebarOpenDesktop, setSidebarOpenDesktop] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [trashModalOpen, setTrashModalOpen] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);
  const titleInputRef = useRef<TextInput>(null);
  const lastAppliedParamPageIdRef = useRef<string | null>(null);
  const draftStateRef = useRef({
    activePage,
    draftTitle: '',
    draftBlocks: draftBlocks,
  });
  draftStateRef.current = { activePage, draftTitle, draftBlocks };

  const notesPalette = theme.modules.notes;
  const headingContrastColor = isDark ? theme.textPrimary : '#0F1115';

  // Navegación profunda por ?pageId=... desde Recordatorios o Dashboard
  useEffect(() => {
    const targetId = typeof params.pageId === 'string' ? params.pageId : null;
    if (
      targetId &&
      targetId !== lastAppliedParamPageIdRef.current &&
      pages.some((p) => p.id === targetId)
    ) {
      lastAppliedParamPageIdRef.current = targetId;
      setActivePageId(targetId);
    }
  }, [params.pageId, pages, setActivePageId]);

  useEffect(() => {
    if (activePage) {
      setDraftTitle(activePage.title);
      setDraftBlocks(loadBlocksForPage(activePage));
    } else {
      setDraftTitle('');
      setDraftBlocks([createBlock('paragraph')]);
    }
  }, [activePage?.id]);

  // Atajo global Cmd+K / Ctrl+K + guard CapsLock título + pegar imágenes del portapapeles (Web) -> WebP ~80 KB -> Cloudflare R2
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return undefined;
    }

    let lastTitleBlur: {
      el: HTMLInputElement;
      start: number | null;
      end: number | null;
      at: number;
    } | null = null;

    const getTitleDom = () =>
      titleInputRef.current as unknown as HTMLInputElement | null;

    const handleTitleFocusOut = (event: FocusEvent) => {
      const titleEl = getTitleDom();
      if (titleEl && event.target === titleEl) {
        try {
          lastTitleBlur = {
            el: titleEl,
            start: titleEl.selectionStart,
            end: titleEl.selectionEnd,
            at: Date.now(),
          };
        } catch {
          lastTitleBlur = { el: titleEl, start: null, end: null, at: Date.now() };
        }
      }
    };

    const handleCapsLockTitle = (event: KeyboardEvent) => {
      if (event.key !== 'CapsLock' && event.code !== 'CapsLock') return;
      const titleEl = getTitleDom();
      if (!titleEl || typeof document === 'undefined') return;

      const active = document.activeElement;
      let shouldRestore = false;
      let sel: { start: number | null; end: number | null } = {
        start: null,
        end: null,
      };

      if (active === titleEl) {
        shouldRestore = true;
        try {
          sel = { start: titleEl.selectionStart, end: titleEl.selectionEnd };
        } catch {
          sel = { start: null, end: null };
        }
      } else if (
        lastTitleBlur &&
        lastTitleBlur.el === titleEl &&
        titleEl.isConnected &&
        Date.now() - lastTitleBlur.at < 250 &&
        (active === null || active === document.body)
      ) {
        shouldRestore = true;
        sel = { start: lastTitleBlur.start, end: lastTitleBlur.end };
      }

      if (!shouldRestore) return;

      const restore = () => {
        if (!titleEl.isConnected) return;
        const nowActive = document.activeElement;
        if (nowActive === null || nowActive === document.body) {
          titleEl.focus({ preventScroll: true });
          if (sel.start !== null && sel.end !== null) {
            try {
              titleEl.setSelectionRange(sel.start, sel.end);
            } catch {
              // Ignorar si no soporta selección
            }
          }
        }
      };

      requestAnimationFrame(restore);
      window.setTimeout(restore, 40);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSpotlightOpen((prev) => !prev);
      }
    };

    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      const imageItem = Array.from(items).find((it) =>
        it.type.startsWith('image/')
      );
      const file = imageItem?.getAsFile();
      const snap = draftStateRef.current;
      if (!file || !snap.activePage) return;

      event.preventDefault();
      const targetPageId = snap.activePage.id;

      void (async () => {
        const compressed = await compressWebImageFile(file);
        const sizeKb = Math.max(1, Math.round(compressed.sizeBytes / 1024));
        const imgBlock = createBlock('image', {
          imageUrl: compressed.dataUrl,
          imageSizeKb: sizeKb,
          imageStatus: 'uploading',
        });

        const cur = draftStateRef.current;
        if (cur.activePage?.id !== targetPageId) return;
        const withImg = [...cur.draftBlocks, imgBlock];
        setDraftBlocks(withImg);
        updatePageBlocks(targetPageId, cur.draftTitle, withImg);

        const uploaded = await uploadCompressedImageToR2(compressed);
        const after = draftStateRef.current;
        if (after.activePage?.id !== targetPageId) return;
        const finalized = after.draftBlocks.map((b) =>
          b.id === imgBlock.id
            ? {
              ...b,
              imageUrl: uploaded.url,
              imageKey: uploaded.key || undefined,
              imageSizeKb: Math.max(1, Math.round(uploaded.sizeBytes / 1024)),
              imageStatus: uploaded.uploadedToR2
                ? ('r2' as const)
                : ('local' as const),
            }
            : b
        );
        setDraftBlocks(finalized);
        updatePageBlocks(targetPageId, after.draftTitle, finalized);
      })();
    };

    document.addEventListener('focusout', handleTitleFocusOut, true);
    window.addEventListener('keydown', handleCapsLockTitle, true);
    window.addEventListener('keyup', handleCapsLockTitle, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('focusout', handleTitleFocusOut, true);
      window.removeEventListener('keydown', handleCapsLockTitle, true);
      window.removeEventListener('keyup', handleCapsLockTitle, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
    };
  }, [updatePageBlocks]);

  const draftMarkdown = useMemo(
    () => serializeBlocksToMarkdown(draftBlocks),
    [draftBlocks]
  );

  const metrics = useMemo(
    () => computeNoteMetrics(draftMarkdown, null),
    [draftMarkdown]
  );

  const checklistStats = useMemo(
    () => computeChecklistProgress(draftBlocks),
    [draftBlocks]
  );

  const showToast = (message: string) => {
    setToastText(message);
    setTimeout(() => {
      setToastText((prev) => (prev === message ? null : prev));
    }, 2400);
  };

  const handleTitleChange = (nextTitle: string) => {
    setDraftTitle(nextTitle);
    if (activePage) {
      updatePageBlocks(activePage.id, nextTitle, draftBlocks);
    }
  };

  const handleBlocksChange = (nextBlocks: NoteBlock[]) => {
    setDraftBlocks(nextBlocks);
    if (activePage) {
      updatePageBlocks(activePage.id, draftTitle, nextBlocks);
    }
  };

  const handlePromoteBlock = (block: NoteBlock) => {
    if (!activePage) return;
    const task = promoteBlockToTask(activePage, block);
    if (task) {
      showToast(`Enviada a Hoy: "${task.title}"`);
    }
  };

  const handleCreateRootPage = (customTitle?: string) => {
    const cleanTitle = customTitle?.trim() || 'Nueva Página';
    const initialBlocks = [
      createBlock('h1', { text: cleanTitle }),
      createBlock('paragraph', { text: '' }),
    ];
    const created = createPage({
      title: cleanTitle,
      icon: 'FileText',
      blocksJson: JSON.stringify(initialBlocks),
      contentMarkdown: serializeBlocksToMarkdown(initialBlocks),
      tags: ['Workspace'],
      isPinned: false,
    });
    setDraftTitle(created.title);
    setDraftBlocks(initialBlocks);
    setMobileDrawerOpen(false);
  };

  const handleCreateSubpage = (parentId: string) => {
    const created = createSubpage(parentId, 'Nueva Subpágina');
    setDraftTitle(created.title);
    setDraftBlocks(loadBlocksForPage(created));
    setMobileDrawerOpen(false);
  };

  const handleSelectTemplate = (templateId: NoteTemplateId) => {
    const created = createFromTemplate(templateId, null);
    setDraftTitle(created.title);
    setDraftBlocks(loadBlocksForPage(created));
    setMobileDrawerOpen(false);
  };

  const handleCopyFullMarkdown = async () => {
    if (!activePage) return;
    const exportText = `# ${draftTitle || activePage.title}\n\n${draftMarkdown}`;
    const ok = await copyTextToClipboard(exportText);
    if (ok) {
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 1600);
    }
  };

  const ActiveIconComp = resolveNoteIcon(activePage?.icon);
  const showDesktopSidebar = isDesktop && sidebarOpenDesktop && !focusMode;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.canvas }]}
      edges={['top']}
    >
      <View style={styles.workspaceRoot}>
        {/* Header superior de pantalla (se oculta en Modo Enfoque) */}
        {!focusMode ? (
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              {isDesktop ? (
                <Pressable
                  onPress={() => setSidebarOpenDesktop((prev) => !prev)}
                  accessibilityLabel={
                    sidebarOpenDesktop ? 'Ocultar árbol' : 'Mostrar árbol'
                  }
                  style={[
                    styles.headerIconBtn,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.glassBorder,
                    },
                  ]}
                >
                  <PanelLeft
                    size={17}
                    color={
                      sidebarOpenDesktop
                        ? theme.accentPrimaryLink
                        : theme.textSecondary
                    }
                  />
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => setMobileDrawerOpen(true)}
                  accessibilityLabel="Abrir explorador de páginas"
                  style={[
                    styles.headerIconBtn,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.glassBorder,
                    },
                  ]}
                >
                  <PanelLeft size={17} color={theme.accentPrimaryLink} />
                </Pressable>
              )}

              <MacIconBadge
                icon={FileText}
                module="notes"
                containerSize={38}
                size={19}
              />

              <View style={styles.headerTitleCol}>
                <Text style={[styles.phaseTag, { color: theme.accentPrimaryLink }]}>
                  Mis ideas
                </Text>
                <Text style={[styles.screenTitle, { color: theme.textPrimary }]}>
                  Notas & Documentos
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                onPress={() => setTemplatesOpen(true)}
                style={[
                  styles.spotlightHeaderBtn,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                <Sparkles size={14} color={theme.accentPrimaryLink} />
                {isDesktop ? (
                  <Text
                    style={[
                      styles.spotlightHeaderText,
                      { color: theme.textPrimary },
                    ]}
                  >
                    Plantillas
                  </Text>
                ) : null}
              </Pressable>

              <Pressable
                onPress={() => setSpotlightOpen(true)}
                style={[
                  styles.spotlightHeaderBtn,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                <Search size={14} color={theme.textSecondary} strokeWidth={2} />
                {isDesktop ? (
                  <Text style={[styles.spotlightHeaderText, { color: theme.textSecondary }]}>
                    Buscar
                  </Text>
                ) : null}
                {Platform.OS === 'web' && isDesktop ? (
                  <View
                    style={[
                      styles.kbdPill,
                      {
                        backgroundColor: theme.pillBg,
                        borderColor: theme.glassBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.kbdPillText, { color: theme.textMuted }]}>
                      ⌘K
                    </Text>
                  </View>
                ) : null}
              </Pressable>

              <Pressable
                onPress={() => handleCreateRootPage()}
                style={[styles.newPageBtn, { backgroundColor: theme.accentPrimary }]}
              >
                <Plus size={15} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.newPageBtnText}>Nueva</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Toast sutil de envío Nota -> Hoy */}
        {toastText ? (
          <Pressable
            onPress={() => router.push('/(tabs)/reminders')}
            style={[
              styles.toastBanner,
              {
                backgroundColor: theme.accentPrimarySoft,
                borderColor: theme.accentPrimaryBorder,
              },
            ]}
          >
            <ListCheck size={15} color={theme.accentPrimaryLink} />
            <Text
              style={[styles.toastText, { color: theme.accentPrimaryLink }]}
              numberOfLines={1}
            >
              {toastText}
            </Text>
            <Text style={[styles.toastLink, { color: theme.textPrimary }]}>
              Ver en Hoy →
            </Text>
          </Pressable>
        ) : null}

        {/* Cuerpo Principal: Sidebar Desktop + Lienzo */}
        <View style={styles.splitStage}>
          {showDesktopSidebar ? (
            <View style={styles.sidebarColumn}>
              <NoteSidebarTree
                pages={pages}
                pinnedPages={pinnedPages}
                tree={tree}
                activePageId={activePage?.id ?? null}
                deletedCount={deletedPages.length}
                onSelectPage={(id) => setActivePageId(id)}
                onCreatePage={() => handleCreateRootPage()}
                onCreateSubpage={handleCreateSubpage}
                onOpenSpotlight={() => setSpotlightOpen(true)}
                onOpenTrash={() => setTrashModalOpen(true)}
              />
            </View>
          ) : null}

          {/* Lienzo de Documento */}
          <ScrollView
            style={styles.canvasScroll}
            contentContainerStyle={[
              styles.canvasContent,
              focusMode && styles.canvasContentFocus,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {activePage ? (
              <LiquidGlassCard style={styles.editorCard} contentStyle={styles.editorContent}>
                {/* Fila superior: Breadcrumbs + Toolbar de acciones */}
                <View style={[styles.topMetaRow, { borderBottomColor: theme.divider }]}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.breadcrumbTrail}
                  >
                    <Pressable
                      onPress={() =>
                        isDesktop
                          ? setSidebarOpenDesktop(true)
                          : setMobileDrawerOpen(true)
                      }
                      style={styles.breadcrumbChip}
                    >
                      <FolderOpen size={13} color={theme.textMuted} />
                      <Text style={[styles.breadcrumbText, { color: theme.textMuted }]}>
                        Workspace
                      </Text>
                    </Pressable>

                    {breadcrumbs.map((crumb, idx) => {
                      const isLast = idx === breadcrumbs.length - 1;
                      const CrumbIcon = resolveNoteIcon(crumb.icon);
                      return (
                        <React.Fragment key={crumb.id}>
                          <ChevronRight
                            size={12}
                            color={theme.textMuted}
                            strokeWidth={2}
                          />
                          <Pressable
                            onPress={() => setActivePageId(crumb.id)}
                            style={[
                              styles.breadcrumbChip,
                              isLast && {
                                backgroundColor: theme.accentPrimarySoft,
                                borderColor: theme.accentPrimaryBorder,
                                borderWidth: 1,
                              },
                            ]}
                          >
                            <CrumbIcon
                              size={12}
                              color={
                                isLast ? theme.accentPrimaryLink : theme.textSecondary
                              }
                            />
                            <Text
                              style={[
                                styles.breadcrumbText,
                                {
                                  color: isLast
                                    ? theme.accentPrimaryLink
                                    : theme.textSecondary,
                                  fontFamily: isLast
                                    ? fontFamilies.bodyBold
                                    : fontFamilies.bodyMedium,
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {crumb.title}
                            </Text>
                          </Pressable>
                        </React.Fragment>
                      );
                    })}
                  </ScrollView>

                  {/* Acciones de página */}
                  <View style={styles.pageActionsRow}>
                    <Pressable
                      onPress={() => handleCreateSubpage(activePage.id)}
                      accessibilityLabel="Crear subpágina"
                      style={[
                        styles.actionChip,
                        {
                          backgroundColor: theme.pillBg,
                          borderColor: theme.glassBorder,
                        },
                      ]}
                    >
                      <DocumentAdd size={13} color={theme.accentPrimaryLink} />
                      {isDesktop ? (
                        <Text style={[styles.actionChipText, { color: theme.textPrimary }]}>
                          Subpágina
                        </Text>
                      ) : null}
                    </Pressable>

                    <Pressable
                      onPress={() => togglePinPage(activePage.id)}
                      accessibilityLabel={
                        activePage.isPinned ? 'Desfijar página' : 'Fijar página'
                      }
                      style={[
                        styles.actionChip,
                        {
                          backgroundColor: activePage.isPinned
                            ? theme.accentPrimarySoft
                            : theme.pillBg,
                          borderColor: activePage.isPinned
                            ? theme.accentPrimaryBorder
                            : theme.glassBorder,
                        },
                      ]}
                    >
                      <Pin
                        size={13}
                        color={
                          activePage.isPinned
                            ? theme.accentPrimaryLink
                            : theme.textSecondary
                        }
                      />
                      {isDesktop ? (
                        <Text
                          style={[
                            styles.actionChipText,
                            {
                              color: activePage.isPinned
                                ? theme.accentPrimaryLink
                                : theme.textSecondary,
                            },
                          ]}
                        >
                          {activePage.isPinned ? 'Fijada' : 'Fijar'}
                        </Text>
                      ) : null}
                    </Pressable>

                    <Pressable
                      onPress={() => void handleCopyFullMarkdown()}
                      accessibilityLabel="Copiar Markdown"
                      style={[
                        styles.actionIconBtn,
                        {
                          backgroundColor: copiedMarkdown
                            ? theme.successSoft
                            : theme.pillBg,
                          borderColor: theme.glassBorder,
                        },
                      ]}
                    >
                      {copiedMarkdown ? (
                        <Check size={13} color={theme.success} strokeWidth={2.2} />
                      ) : (
                        <Copy size={13} color={theme.textSecondary} />
                      )}
                    </Pressable>

                    <Pressable
                      onPress={() => setMoveModalOpen(true)}
                      accessibilityLabel="Mover página"
                      style={[
                        styles.actionIconBtn,
                        {
                          backgroundColor: theme.pillBg,
                          borderColor: theme.glassBorder,
                        },
                      ]}
                    >
                      <MoveRight size={13} color={theme.textSecondary} strokeWidth={2} />
                    </Pressable>

                    <Pressable
                      onPress={() => duplicatePage(activePage.id)}
                      accessibilityLabel="Duplicar página"
                      style={[
                        styles.actionIconBtn,
                        {
                          backgroundColor: theme.pillBg,
                          borderColor: theme.glassBorder,
                        },
                      ]}
                    >
                      <DocumentAdd size={13} color={theme.textSecondary} />
                    </Pressable>

                    <Pressable
                      onPress={() => setFocusMode((prev) => !prev)}
                      accessibilityLabel={
                        focusMode ? 'Salir de modo enfoque' : 'Modo enfoque'
                      }
                      style={[
                        styles.actionIconBtn,
                        {
                          backgroundColor: focusMode
                            ? theme.accentPrimarySoft
                            : theme.pillBg,
                          borderColor: focusMode
                            ? theme.accentPrimaryBorder
                            : theme.glassBorder,
                        },
                      ]}
                    >
                      {focusMode ? (
                        <Minimize2
                          size={13}
                          color={theme.accentPrimaryLink}
                          strokeWidth={2}
                        />
                      ) : (
                        <Maximize2
                          size={13}
                          color={theme.textSecondary}
                          strokeWidth={2}
                        />
                      )}
                    </Pressable>

                    <Pressable
                      onPress={() => deletePage(activePage.id)}
                      accessibilityLabel="Mover a papelera"
                      style={[
                        styles.actionIconBtn,
                        {
                          backgroundColor: theme.dangerSoft,
                          borderColor: theme.accentPrimaryBorder,
                        },
                      ]}
                    >
                      <Trash2 size={13} color={theme.danger} />
                    </Pressable>
                  </View>
                </View>

                {/* Cabecera del documento: Icono seleccionable + Título alto contraste */}
                <View style={styles.docHeaderRow}>
                  <Pressable
                    onPress={() => setIconPickerOpen(true)}
                    accessibilityLabel="Cambiar icono de página"
                    style={[
                      styles.docIconBtn,
                      {
                        backgroundColor: notesPalette.background,
                        borderColor: notesPalette.border,
                      },
                    ]}
                  >
                    <ActiveIconComp size={22} color={theme.accentPrimaryLink} />
                  </Pressable>

                  <TextInput
                    ref={titleInputRef}
                    value={draftTitle}
                    onChangeText={handleTitleChange}
                    placeholder="Título de la página..."
                    placeholderTextColor={theme.textMuted}
                    style={[
                      styles.pageTitleInput,
                      { color: headingContrastColor },
                    ]}
                  />
                </View>

                {/* Barra de estado discreta (Autoguardado + progreso checklists + lectura) */}
                <View style={styles.metricsStrip}>
                  <View style={styles.metricsLeftGroup}>
                    <View
                      style={[
                        styles.statusChip,
                        { backgroundColor: theme.accentPrimarySoft },
                      ]}
                    >
                      <Sparkles size={11} color={theme.accentPrimaryLink} />
                      <Text
                        style={[
                          styles.statusChipText,
                          { color: theme.accentPrimaryLink },
                        ]}
                      >
                        Guardado en la nube
                      </Text>
                    </View>

                    {checklistStats.total > 0 ? (
                      <View
                        style={[
                          styles.checklistBadge,
                          {
                            backgroundColor: theme.pillBg,
                            borderColor: theme.glassBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.checklistBadgeText,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {checklistStats.done}/{checklistStats.total} checklist
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.metricsRight}>
                    <Hash size={11} color={theme.textMuted} strokeWidth={2} />
                    <Text style={[styles.metricsText, { color: theme.textMuted }]}>
                      {metrics.wordCount} palabras
                      {metrics.readingMinutes > 0
                        ? ` · ${metrics.readingMinutes} min lectura`
                        : ''}
                    </Text>
                  </View>
                </View>

                {/* Editor Híbrido: Bloques ligeros + Atajos Markdown + Nota -> Hoy */}
                <NoteBlockEditor
                  blocks={draftBlocks}
                  linkedTasksByBlockId={linkedTasksByBlockId}
                  headingColor={headingContrastColor}
                  onChangeBlocks={handleBlocksChange}
                  onPromoteBlockToTask={handlePromoteBlock}
                  onOpenLinkedTask={() => router.push('/(tabs)/reminders')}
                />

                {/* Subpáginas Anidadas (Estilo Notion) */}
                <View style={[styles.subpagesSection, { borderTopColor: theme.divider }]}>
                  <View style={styles.subpagesHeader}>
                    <Text style={[styles.subpagesTitle, { color: theme.textSecondary }]}>
                      SUBPÁGINAS ANIDADAS ({activeSubpages.length})
                    </Text>
                    <Pressable
                      onPress={() => handleCreateSubpage(activePage.id)}
                      style={[
                        styles.addSubpagePill,
                        {
                          backgroundColor: theme.accentPrimarySoft,
                          borderColor: theme.accentPrimaryBorder,
                        },
                      ]}
                    >
                      <Plus size={12} color={theme.accentPrimaryLink} strokeWidth={2.2} />
                      <Text
                        style={[
                          styles.addSubpageText,
                          { color: theme.accentPrimaryLink },
                        ]}
                      >
                        Añadir subpágina
                      </Text>
                    </Pressable>
                  </View>

                  {activeSubpages.length > 0 ? (
                    <View style={styles.subpagesGrid}>
                      {activeSubpages.map((child) => {
                        const ChildIcon = resolveNoteIcon(child.icon);
                        const nestedCount = getDirectChildren(pages, child.id).length;
                        const snippet = child.contentMarkdown
                          .replace(/[#>*`\[\]-]/g, ' ')
                          .replace(/\s+/g, ' ')
                          .trim();

                        return (
                          <Pressable
                            key={child.id}
                            onPress={() => setActivePageId(child.id)}
                            style={({ pressed }) => [
                              styles.subpageCard,
                              {
                                width: isDesktop ? '48.8%' : '100%',
                                backgroundColor: theme.cardElevated,
                                borderColor: theme.glassBorder,
                                opacity: pressed ? 0.85 : 1,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.subpageIconBox,
                                { backgroundColor: theme.pillBg },
                              ]}
                            >
                              <ChildIcon size={16} color={theme.accentPrimaryLink} />
                            </View>
                            <View style={styles.subpageBody}>
                              <Text
                                style={[
                                  styles.subpageCardTitle,
                                  { color: theme.textPrimary },
                                ]}
                                numberOfLines={1}
                              >
                                {child.title}
                              </Text>
                              <Text
                                style={[
                                  styles.subpageCardMeta,
                                  { color: theme.textMuted },
                                ]}
                                numberOfLines={1}
                              >
                                {nestedCount > 0
                                  ? `${nestedCount} subpágina${nestedCount === 1 ? '' : 's'} · `
                                  : ''}
                                {snippet || 'Página vacía'}
                              </Text>
                            </View>
                            <ChevronRight
                              size={14}
                              color={theme.textMuted}
                              strokeWidth={2}
                            />
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={[styles.subpagesEmpty, { color: theme.textMuted }]}>
                      Sin subpáginas todavía. Anida documentos dentro de esta página para organizar ideas o especificaciones.
                    </Text>
                  )}
                </View>
              </LiquidGlassCard>
            ) : (
              <LiquidGlassCard style={styles.editorCard} contentStyle={styles.emptyState}>
                <FileText size={32} color={theme.accentPrimaryLink} />
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                  No hay notas activas
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                  Crea una página nueva, usa una plantilla de 1 toque o recupera desde la papelera.
                </Text>
                <View style={styles.emptyActions}>
                  <Pressable
                    onPress={() => handleCreateRootPage()}
                    style={[
                      styles.newPageBtn,
                      { backgroundColor: theme.accentPrimary },
                    ]}
                  >
                    <Plus size={15} color="#FFFFFF" strokeWidth={2.2} />
                    <Text style={styles.newPageBtnText}>Crear página</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setTemplatesOpen(true)}
                    style={[
                      styles.actionChip,
                      {
                        backgroundColor: theme.accentPrimarySoft,
                        borderColor: theme.accentPrimaryBorder,
                      },
                    ]}
                  >
                    <Sparkles size={13} color={theme.accentPrimaryLink} />
                    <Text
                      style={[
                        styles.actionChipText,
                        { color: theme.accentPrimaryLink },
                      ]}
                    >
                      Plantillas
                    </Text>
                  </Pressable>
                  {deletedPages.length > 0 ? (
                    <Pressable
                      onPress={() => setTrashModalOpen(true)}
                      style={[
                        styles.actionChip,
                        {
                          backgroundColor: theme.pillBg,
                          borderColor: theme.glassBorder,
                        },
                      ]}
                    >
                      <Trash2 size={13} color={theme.textSecondary} />
                      <Text style={[styles.actionChipText, { color: theme.textPrimary }]}>
                        Papelera ({deletedPages.length})
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </LiquidGlassCard>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Drawer lateral en Móvil */}
      <Modal
        visible={mobileDrawerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMobileDrawerOpen(false)}
      >
        <Pressable
          style={styles.drawerBackdrop}
          onPress={() => setMobileDrawerOpen(false)}
        >
          <Pressable
            style={[styles.drawerPanel, { backgroundColor: theme.canvas }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.drawerTop}>
              <Text style={[styles.drawerTitle, { color: theme.textPrimary }]}>
                Páginas del Workspace
              </Text>
              <Pressable onPress={() => setMobileDrawerOpen(false)} hitSlop={8}>
                <X size={18} color={theme.textSecondary} strokeWidth={2} />
              </Pressable>
            </View>
            <NoteSidebarTree
              pages={pages}
              pinnedPages={pinnedPages}
              tree={tree}
              activePageId={activePage?.id ?? null}
              deletedCount={deletedPages.length}
              compactHeader
              onSelectPage={(id) => {
                setActivePageId(id);
                setMobileDrawerOpen(false);
              }}
              onCreatePage={() => handleCreateRootPage()}
              onCreateSubpage={handleCreateSubpage}
              onOpenSpotlight={() => {
                setMobileDrawerOpen(false);
                setSpotlightOpen(true);
              }}
              onOpenTrash={() => {
                setMobileDrawerOpen(false);
                setTrashModalOpen(true);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Búsqueda Instantánea Spotlight (FTS5 / Web Index) */}
      <NoteSpotlightModal
        visible={spotlightOpen}
        allPages={pages}
        searchPages={searchPages}
        onSelectPage={(id) => setActivePageId(id)}
        onCreateFromQuery={(title) => handleCreateRootPage(title)}
        onClose={() => setSpotlightOpen(false)}
      />

      {/* Plantillas de 1 Toque */}
      <NoteTemplatesModal
        visible={templatesOpen}
        onSelectTemplate={handleSelectTemplate}
        onClose={() => setTemplatesOpen(false)}
      />

      {/* Selector de Icono Solar */}
      {activePage ? (
        <NoteIconPickerModal
          visible={iconPickerOpen}
          currentIcon={activePage.icon}
          onSelectIcon={(icon) => updatePage(activePage.id, { icon })}
          onClose={() => setIconPickerOpen(false)}
        />
      ) : null}

      {/* Mover página a otro padre / raíz */}
      <NoteMoveModal
        visible={moveModalOpen}
        page={activePage}
        allPages={pages}
        onMove={(newParentId) => {
          if (activePage) movePage(activePage.id, newParentId);
        }}
        onClose={() => setMoveModalOpen(false)}
      />

      {/* Papelera de notas (Soft Delete / Restaurar) */}
      <NoteTrashModal
        visible={trashModalOpen}
        deletedPages={deletedPages}
        onRestore={(id) => restorePage(id)}
        onClose={() => setTrashModalOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  workspaceRoot: {
    flex: 1,
    width: '100%',
    maxWidth: 1220,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.squircle,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    flexShrink: 1,
  },
  phaseTag: {
    fontSize: 10,
    ...typography.eyebrow,
  },
  screenTitle: {
    fontSize: 23,
    ...typography.screenTitle,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  spotlightHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  spotlightHeaderText: {
    fontSize: 12,
    ...typography.bodySemiBold,
  },
  kbdPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
    borderWidth: 1,
  },
  kbdPillText: {
    fontSize: 10,
    fontWeight: '700',
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
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  toastText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  toastLink: {
    fontSize: 12,
    fontWeight: '700',
  },
  splitStage: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  sidebarColumn: {
    width: 278,
    paddingBottom: 96,
  },
  canvasScroll: {
    flex: 1,
  },
  canvasContent: {
    paddingBottom: 120,
  },
  canvasContentFocus: {
    maxWidth: 820,
    width: '100%',
    alignSelf: 'center',
    paddingTop: spacing.sm,
  },
  editorCard: {
    borderRadius: radii.xl,
  },
  editorContent: {
    gap: spacing.md,
  },
  topMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  breadcrumbTrail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  breadcrumbChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    maxWidth: 180,
  },
  breadcrumbText: {
    fontSize: 12,
    ...typography.bodyMedium,
  },
  pageActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  actionChipText: {
    fontSize: 11,
    ...typography.bodySemiBold,
  },
  actionIconBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  docIconBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.squircle,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitleInput: {
    flex: 1,
    fontSize: 24,
    paddingVertical: 4,
    ...typography.docTitle,
  },
  metricsStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metricsLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    fontWeight: '700',
  },
  checklistBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  checklistBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  metricsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metricsText: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    ...typography.caption,
  },
  subpagesSection: {
    borderTopWidth: 1,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  subpagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  subpagesTitle: {
    fontSize: 11,
    ...typography.eyebrow,
  },
  addSubpagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  addSubpageText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subpagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  subpageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 11,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  subpageIconBox: {
    width: 34,
    height: 34,
    borderRadius: radii.squircle,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subpageBody: {
    flex: 1,
    gap: 2,
  },
  subpageCardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  subpageCardMeta: {
    fontSize: 11,
    ...typography.caption,
  },
  subpagesEmpty: {
    fontSize: 12,
    lineHeight: 18,
    ...typography.body,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 17,
    ...typography.cardTitle,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 320,
  },
  emptyActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
    flexDirection: 'row',
  },
  drawerPanel: {
    width: '84%',
    maxWidth: 320,
    height: '100%',
    padding: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 54 : spacing.lg,
    gap: spacing.sm,
  },
  drawerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  drawerTitle: {
    fontSize: 15,
    ...typography.cardTitle,
  },
});
