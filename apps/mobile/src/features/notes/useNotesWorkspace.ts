import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NotePageRecord, TaskRecord } from '@organiza/shared/schema';
import {
  createLocalId,
  localStore,
  nextMonotonicTimestamp,
  notifyDatabaseChanged,
  subscribeDatabaseChanges,
} from '../../db/client';
import { triggerBackgroundSync } from '../../db/sync';
import { insertTaskOfflineFirst } from '../today';
import {
  serializeBlocksToMarkdown,
  type NoteBlock,
} from './noteBlocks';
import {
  instantiateNoteTemplate,
  type NoteTemplateId,
} from './noteTemplates';
import {
  buildNoteTree,
  getBreadcrumbTrail,
  getDescendantIds,
  getDirectChildren,
  type NoteTreeNode,
} from './noteTree';

export interface CreateNotePageInput {
  title: string;
  contentMarkdown?: string;
  blocksJson?: string | null;
  icon?: string;
  tags?: string[];
  isPinned?: boolean;
  parentId?: string | null;
  sortOrder?: number;
  userId?: string;
}

export interface UpdateNotePageInput {
  title?: string;
  contentMarkdown?: string;
  blocksJson?: string | null;
  icon?: string;
  tags?: string[];
  isPinned?: boolean;
  parentId?: string | null;
  sortOrder?: number;
}

export function insertNotePageOfflineFirst(input: CreateNotePageInput): NotePageRecord {
  const now = nextMonotonicTimestamp();
  const record: NotePageRecord = {
    id: createLocalId(),
    userId: input.userId || localStore.getActiveUserId(),
    parentId: input.parentId ?? null,
    title: input.title.trim() || 'Página sin título',
    icon: input.icon ?? 'FileText',
    contentMarkdown: input.contentMarkdown ?? '',
    blocksJson: input.blocksJson ?? null,
    tags: JSON.stringify(input.tags ?? ['Notas']),
    isPinned: input.isPinned ?? false,
    sortOrder: input.sortOrder ?? 0,
    isDirty: true,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  localStore.upsertNotePage(record);
  notifyDatabaseChanged();
  triggerBackgroundSync();
  return record;
}

/**
 * FASE 2 — PASOS 1–4:
 * Hook Offline-First para Workspace estilo Notion + Obsidian
 * (Subpáginas infinitas, FTS5/Spotlight, Editor por Bloques, Nota->Hoy y Plantillas).
 */
export function useNotesWorkspace(userId = '') {
  const [pages, setPages] = useState<NotePageRecord[]>(() => localStore.getNotePages());
  const [deletedPages, setDeletedPages] = useState<NotePageRecord[]>(() =>
    localStore.getDeletedNotePages()
  );
  const [tasks, setTasks] = useState<TaskRecord[]>(() => localStore.getTasks());
  const [activePageId, setActivePageId] = useState<string | null>(() => {
    const initial = localStore.getNotePages();
    return initial[0]?.id ?? null;
  });

  const refreshAll = useCallback(() => {
    const nextPages = localStore.getNotePages();
    const nextDeleted = localStore.getDeletedNotePages();
    const nextTasks = localStore.getTasks();
    setPages(nextPages);
    setDeletedPages(nextDeleted);
    setTasks(nextTasks);
    setActivePageId((prevId) => {
      if (prevId && nextPages.some((p) => p.id === prevId)) {
        return prevId;
      }
      return nextPages[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    return subscribeDatabaseChanges(refreshAll);
  }, [refreshAll]);

  const activePage = useMemo(
    () => pages.find((p) => p.id === activePageId) ?? pages[0] ?? null,
    [pages, activePageId]
  );

  const pinnedPages = useMemo(
    () => pages.filter((p) => p.isPinned),
    [pages]
  );

  const tree: NoteTreeNode[] = useMemo(() => buildNoteTree(pages), [pages]);

  const breadcrumbs = useMemo(
    () => getBreadcrumbTrail(pages, activePage?.id ?? null),
    [pages, activePage?.id]
  );

  const activeSubpages = useMemo(
    () => (activePage ? getDirectChildren(pages, activePage.id) : []),
    [pages, activePage]
  );

  const linkedTasksByBlockId = useMemo<Record<string, TaskRecord>>(() => {
    if (!activePage) return {};
    const map: Record<string, TaskRecord> = {};
    for (const task of tasks) {
      if (task.sourcePageId === activePage.id && task.sourceBlockId) {
        map[task.sourceBlockId] = task;
      }
    }
    return map;
  }, [tasks, activePage?.id]);

  const createPage = useCallback(
    (input: CreateNotePageInput) => {
      const created = insertNotePageOfflineFirst({ ...input, userId });
      setActivePageId(created.id);
      return created;
    },
    [userId]
  );

  const createSubpage = useCallback(
    (parentId: string, title = 'Nueva Subpágina') => {
      const siblings = localStore
        .getNotePages()
        .filter((p) => p.parentId === parentId);
      const created = insertNotePageOfflineFirst({
        title,
        parentId,
        icon: 'FileText',
        contentMarkdown: `# ${title}\n\nEscribe ideas, checklists o documentación...`,
        tags: ['Subpágina'],
        isPinned: false,
        sortOrder: siblings.length,
        userId,
      });
      setActivePageId(created.id);
      return created;
    },
    [userId]
  );

  const createFromTemplate = useCallback(
    (templateId: NoteTemplateId, parentId: string | null = null) => {
      const tpl = instantiateNoteTemplate(templateId);
      const created = insertNotePageOfflineFirst({
        title: tpl.title,
        icon: tpl.icon,
        tags: tpl.tags,
        blocksJson: JSON.stringify(tpl.blocks),
        contentMarkdown: tpl.contentMarkdown,
        parentId,
        isPinned: false,
        userId,
      });
      setActivePageId(created.id);
      return created;
    },
    [userId]
  );

  const updatePage = useCallback((pageId: string, input: UpdateNotePageInput) => {
    const existing = localStore.getNotePageById(pageId);
    const patch: Partial<NotePageRecord> = {
      isDirty: true,
      updatedAt: nextMonotonicTimestamp(existing?.updatedAt),
    };
    if (input.title !== undefined) {
      patch.title = input.title.trim() || 'Página sin título';
    }
    if (input.contentMarkdown !== undefined) {
      patch.contentMarkdown = input.contentMarkdown;
    }
    if (input.blocksJson !== undefined) {
      patch.blocksJson = input.blocksJson;
    }
    if (input.icon !== undefined) {
      patch.icon = input.icon;
    }
    if (input.tags !== undefined) {
      patch.tags = JSON.stringify(input.tags);
    }
    if (input.isPinned !== undefined) {
      patch.isPinned = input.isPinned;
    }
    if (input.parentId !== undefined) {
      patch.parentId = input.parentId;
    }
    if (input.sortOrder !== undefined) {
      patch.sortOrder = input.sortOrder;
    }

    localStore.updateNotePage(pageId, patch);
    notifyDatabaseChanged();
    triggerBackgroundSync();
  }, []);

  const updatePageMarkdown = useCallback(
    (pageId: string, title: string, contentMarkdown: string) => {
      updatePage(pageId, { title, contentMarkdown });
    },
    [updatePage]
  );

  const updatePageBlocks = useCallback(
    (pageId: string, title: string, blocks: NoteBlock[]) => {
      const contentMarkdown = serializeBlocksToMarkdown(blocks);
      const blocksJson = JSON.stringify(blocks);
      updatePage(pageId, { title, contentMarkdown, blocksJson });
    },
    [updatePage]
  );

  const promoteBlockToTask = useCallback(
    (page: NotePageRecord, block: NoteBlock): TaskRecord | null => {
      const cleanTitle = block.text.trim();
      if (!cleanTitle) return null;

      // Si ya existe tarea vinculada a este bloque, retorna la existente
      const existing = localStore
        .getTasks()
        .find((t) => t.sourcePageId === page.id && t.sourceBlockId === block.id);
      if (existing) {
        return existing;
      }

      return insertTaskOfflineFirst({
        title: cleanTitle,
        notes: `Desde nota: ${page.title}`,
        category: 'today',
        priority: 2,
        sourcePageId: page.id,
        sourceBlockId: block.id,
        userId,
      });
    },
    [userId]
  );

  const togglePinPage = useCallback((pageId: string) => {
    const current = localStore.getNotePageById(pageId);
    if (!current) return;
    localStore.updateNotePage(pageId, {
      isPinned: !current.isPinned,
      isDirty: true,
      updatedAt: nextMonotonicTimestamp(current.updatedAt),
    });
    notifyDatabaseChanged();
    triggerBackgroundSync();
  }, []);

  const duplicatePage = useCallback(
    (pageId: string) => {
      const source = localStore.getNotePageById(pageId);
      if (!source) return null;
      let parsedTags: string[] = ['Notas'];
      try {
        const raw = JSON.parse(source.tags) as unknown;
        if (Array.isArray(raw)) {
          parsedTags = raw.filter((t): t is string => typeof t === 'string');
        }
      } catch {
        // Mantiene tag por defecto
      }
      const created = insertNotePageOfflineFirst({
        title: `${source.title} (Copia)`,
        contentMarkdown: source.contentMarkdown,
        blocksJson: source.blocksJson,
        icon: source.icon,
        tags: parsedTags,
        isPinned: false,
        parentId: source.parentId,
        sortOrder: source.sortOrder + 1,
        userId,
      });
      setActivePageId(created.id);
      return created;
    },
    [userId]
  );

  const movePage = useCallback((pageId: string, newParentId: string | null) => {
    const allPages = localStore.getNotePages();
    if (newParentId) {
      const blockedIds = getDescendantIds(allPages, pageId);
      if (blockedIds.has(newParentId)) {
        return false;
      }
    }
    const current = localStore.getNotePageById(pageId);
    localStore.updateNotePage(pageId, {
      parentId: newParentId,
      isDirty: true,
      updatedAt: nextMonotonicTimestamp(current?.updatedAt),
    });
    notifyDatabaseChanged();
    triggerBackgroundSync();
    return true;
  }, []);

  const deletePage = useCallback(
    (pageId: string) => {
      const allActive = localStore.getNotePages();
      const target = allActive.find((p) => p.id === pageId);
      const subtreeIds = getDescendantIds(allActive, pageId);

      for (const id of subtreeIds) {
        const page = localStore.getNotePageById(id);
        const now = nextMonotonicTimestamp(page?.updatedAt);
        localStore.updateNotePage(id, {
          deletedAt: now,
          isPinned: false,
          isDirty: true,
          updatedAt: now,
        });
      }

      if (activePageId && subtreeIds.has(activePageId)) {
        const remaining = allActive.filter((p) => !subtreeIds.has(p.id));
        const fallbackParent =
          target?.parentId && remaining.some((p) => p.id === target.parentId)
            ? target.parentId
            : remaining[0]?.id ?? null;
        setActivePageId(fallbackParent);
      }

      notifyDatabaseChanged();
      triggerBackgroundSync();
    },
    [activePageId]
  );

  const restorePage = useCallback((pageId: string) => {
    const target = localStore.getNotePageById(pageId);
    if (!target) return;
    const parent = target.parentId
      ? localStore.getNotePageById(target.parentId)
      : undefined;
    const restoredParentId =
      parent && !parent.deletedAt ? target.parentId : null;

    localStore.updateNotePage(pageId, {
      deletedAt: null,
      parentId: restoredParentId,
      isDirty: true,
      updatedAt: nextMonotonicTimestamp(target.updatedAt),
    });
    setActivePageId(pageId);
    notifyDatabaseChanged();
    triggerBackgroundSync();
  }, []);

  const searchPages = useCallback((query: string, limit = 20): NotePageRecord[] => {
    return localStore.searchNotePages(query, limit);
  }, []);

  return {
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
    updatePageMarkdown,
    updatePageBlocks,
    promoteBlockToTask,
    togglePinPage,
    duplicatePage,
    movePage,
    deletePage,
    restorePage,
    searchPages,
  };
}
