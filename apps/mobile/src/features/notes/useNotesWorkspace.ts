import { useCallback, useEffect, useState } from 'react';
import type { NotePageRecord } from '@organiza/shared/schema';
import {
  localStore,
  createLocalId,
  notifyDatabaseChanged,
  subscribeDatabaseChanges,
} from '../../db/client';
import { triggerBackgroundSync } from '../../db/sync';

export interface CreateNotePageInput {
  title: string;
  contentMarkdown?: string;
  icon?: string;
  tags?: string[];
  isPinned?: boolean;
  parentId?: string | null;
  userId?: string;
}

export function insertNotePageOfflineFirst(input: CreateNotePageInput): NotePageRecord {
  const now = Date.now();
  const record: NotePageRecord = {
    id: createLocalId(),
    userId: input.userId || 'local-user',
    parentId: input.parentId ?? null,
    title: input.title.trim() || 'Página sin título',
    icon: input.icon ?? 'FileText',
    contentMarkdown: input.contentMarkdown ?? '',
    tags: JSON.stringify(input.tags ?? ['Notas']),
    isPinned: input.isPinned ?? false,
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
 * FASE 2: Hook Offline-First para Workspace estilo Notion + Bloc Markdown
 * (Compatible con Web, iOS y Android).
 */
export function useNotesWorkspace(userId = 'local-user') {
  const [pages, setPages] = useState<NotePageRecord[]>(() => localStore.getNotePages());
  const [activePageId, setActivePageId] = useState<string | null>(() => {
    const initial = localStore.getNotePages();
    return initial[0]?.id ?? null;
  });

  const refreshPages = useCallback(() => {
    const updated = localStore.getNotePages();
    setPages(updated);
    if (!activePageId && updated[0]) {
      setActivePageId(updated[0].id);
    }
  }, [activePageId]);

  useEffect(() => {
    return subscribeDatabaseChanges(refreshPages);
  }, [refreshPages]);

  const activePage = pages.find((p) => p.id === activePageId) ?? pages[0] ?? null;

  const createPage = useCallback(
    (input: CreateNotePageInput) => {
      const created = insertNotePageOfflineFirst({ ...input, userId });
      setActivePageId(created.id);
      return created;
    },
    [userId]
  );

  const updatePageMarkdown = useCallback(
    (pageId: string, title: string, contentMarkdown: string) => {
      const now = Date.now();
      localStore.updateNotePage(pageId, {
        title: title.trim() || 'Página sin título',
        contentMarkdown,
        isDirty: true,
        updatedAt: now,
      });
      notifyDatabaseChanged();
      triggerBackgroundSync();
    },
    []
  );

  const togglePinPage = useCallback((pageId: string) => {
    const current = localStore.getNotePageById(pageId);
    if (!current) {
      return;
    }
    const now = Date.now();
    localStore.updateNotePage(pageId, {
      isPinned: !current.isPinned,
      isDirty: true,
      updatedAt: now,
    });
    notifyDatabaseChanged();
    triggerBackgroundSync();
  }, []);

  return {
    pages,
    activePage,
    activePageId,
    setActivePageId,
    createPage,
    updatePageMarkdown,
    togglePinPage,
  };
}
