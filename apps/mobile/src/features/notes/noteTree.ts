import type { NotePageRecord } from '@organiza/shared/schema';
import {
  extractPlainTextFromBlocksJson,
  normalizeSearchText,
  parseTagsText,
} from '../../db/seedData';
import {
  isLegacyPlaceholderTitle,
  loadBlocksForPage,
  serializeBlocksToMarkdown,
} from './noteBlocks';

export interface NoteTreeNode {
  page: NotePageRecord;
  depth: number;
  children: NoteTreeNode[];
  descendantCount: number;
}

export interface NoteSearchSnippetParts {
  before: string;
  match: string;
  after: string;
}

export interface NoteSearchHit {
  page: NotePageRecord;
  breadcrumb: string[];
  matchedInTitle: boolean;
  snippetParts: NoteSearchSnippetParts | null;
}

export interface NoteMetrics {
  wordCount: number;
  readingMinutes: number;
  charCount: number;
}

export function normalizeEditableNoteTitle(title: string): string {
  const clean = title.trim();
  if (!clean || isLegacyPlaceholderTitle(clean)) {
    return '';
  }
  return title;
}

export function hasCustomNoteTitle(
  page: Pick<NotePageRecord, 'title'>
): boolean {
  return normalizeEditableNoteTitle(page.title).trim().length > 0;
}

export function getNoteDisplayTitle(
  page: Pick<NotePageRecord, 'title' | 'parentId'>
): string {
  const clean = normalizeEditableNoteTitle(page.title).trim();
  if (clean) return clean;
  return page.parentId ? 'Nueva Subpágina' : 'Página sin título';
}

export function getNotePreviewText(
  page: Pick<NotePageRecord, 'blocksJson' | 'contentMarkdown'>
): string {
  const blocks = loadBlocksForPage(page);
  const md = serializeBlocksToMarkdown(blocks);
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+\[[xX ]\]\s*/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compareNoteSiblings(a: NotePageRecord, b: NotePageRecord): number {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return b.updatedAt - a.updatedAt;
}

/**
 * Construye el árbol recursivo seguro contra ciclos para páginas infinitas.
 * Cualquier página sin padre activo en el workspace se ubica en la raíz.
 */
export function buildNoteTree(pages: NotePageRecord[]): NoteTreeNode[] {
  const byId = new Map<string, NotePageRecord>();
  for (const page of pages) {
    if (!page.deletedAt) {
      byId.set(page.id, page);
    }
  }

  const childrenMap = new Map<string | null, NotePageRecord[]>();
  for (const page of byId.values()) {
    const validParentId =
      page.parentId && page.parentId !== page.id && byId.has(page.parentId)
        ? page.parentId
        : null;
    const bucket = childrenMap.get(validParentId);
    if (bucket) {
      bucket.push(page);
    } else {
      childrenMap.set(validParentId, [page]);
    }
  }

  for (const bucket of childrenMap.values()) {
    bucket.sort(compareNoteSiblings);
  }

  const visited = new Set<string>();

  function visit(page: NotePageRecord, depth: number): NoteTreeNode | null {
    if (visited.has(page.id)) return null;
    visited.add(page.id);

    const rawChildren = childrenMap.get(page.id) ?? [];
    const childNodes: NoteTreeNode[] = [];
    let descendantCount = 0;

    for (const child of rawChildren) {
      const childNode = visit(child, depth + 1);
      if (childNode) {
        childNodes.push(childNode);
        descendantCount += 1 + childNode.descendantCount;
      }
    }

    return {
      page,
      depth,
      children: childNodes,
      descendantCount,
    };
  }

  const roots: NoteTreeNode[] = [];
  for (const rootPage of childrenMap.get(null) ?? []) {
    const node = visit(rootPage, 0);
    if (node) roots.push(node);
  }

  // En caso de componente cíclico aislado, expone nodos no visitados en raíz
  for (const page of byId.values()) {
    if (!visited.has(page.id)) {
      const node = visit(page, 0);
      if (node) roots.push(node);
    }
  }

  return roots;
}

export function flattenNoteTree(
  nodes: NoteTreeNode[]
): Array<{ page: NotePageRecord; depth: number }> {
  const result: Array<{ page: NotePageRecord; depth: number }> = [];
  const walk = (list: NoteTreeNode[]) => {
    for (const node of list) {
      result.push({ page: node.page, depth: node.depth });
      walk(node.children);
    }
  };
  walk(nodes);
  return result;
}

/**
 * Retorna la ruta breadcrumb ordenada [raíz, ..., página actual] segura contra ciclos.
 */
export function getBreadcrumbTrail(
  pages: NotePageRecord[],
  pageId?: string | null
): NotePageRecord[] {
  if (!pageId) return [];
  const byId = new Map(pages.filter((p) => !p.deletedAt).map((p) => [p.id, p]));
  const trail: NotePageRecord[] = [];
  const seen = new Set<string>();

  let cursorId: string | null = pageId;
  while (cursorId && !seen.has(cursorId)) {
    const current = byId.get(cursorId);
    if (!current) break;
    seen.add(cursorId);
    trail.unshift(current);
    cursorId = current.parentId ?? null;
  }

  return trail;
}

export function getDirectChildren(
  pages: NotePageRecord[],
  parentId: string
): NotePageRecord[] {
  return pages
    .filter((p) => !p.deletedAt && p.parentId === parentId)
    .sort(compareNoteSiblings);
}

/**
 * Incluye el `rootPageId` y todos sus descendientes activos (para borrar o validar ciclos al mover).
 */
export function getDescendantIds(
  pages: NotePageRecord[],
  rootPageId: string
): Set<string> {
  const result = new Set<string>([rootPageId]);
  const childrenByParent = new Map<string, string[]>();

  for (const page of pages) {
    if (!page.parentId) continue;
    const list = childrenByParent.get(page.parentId);
    if (list) list.push(page.id);
    else childrenByParent.set(page.parentId, [page.id]);
  }

  const stack = [rootPageId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const childId of childrenByParent.get(current) ?? []) {
      if (!result.has(childId)) {
        result.add(childId);
        stack.push(childId);
      }
    }
  }

  return result;
}

function buildSnippetParts(
  sourceText: string,
  rawQuery: string
): NoteSearchSnippetParts | null {
  const cleanSource = sourceText.replace(/\s+/g, ' ').trim();
  if (!cleanSource) return null;

  const normalizedQuery = normalizeSearchText(rawQuery);
  if (!normalizedQuery) {
    const preview =
      cleanSource.length > 110 ? `${cleanSource.slice(0, 110)}...` : cleanSource;
    return { before: preview, match: '', after: '' };
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const lowerSource = cleanSource.toLowerCase();

  let matchIndex = lowerSource.indexOf(normalizedQuery);
  let matchLen = normalizedQuery.length;

  if (matchIndex === -1) {
    for (const tok of tokens) {
      const idx = lowerSource.indexOf(tok);
      if (idx !== -1) {
        matchIndex = idx;
        matchLen = tok.length;
        break;
      }
    }
  }

  // Fallback si la coincidencia solo difiere por tildes/diacríticos
  if (matchIndex === -1) {
    const preview =
      cleanSource.length > 110 ? `${cleanSource.slice(0, 110)}...` : cleanSource;
    return { before: preview, match: '', after: '' };
  }

  const start = Math.max(0, matchIndex - 36);
  const end = Math.min(cleanSource.length, matchIndex + matchLen + 64);

  const prefixEllipsis = start > 0 ? '...' : '';
  const suffixEllipsis = end < cleanSource.length ? '...' : '';

  return {
    before: prefixEllipsis + cleanSource.slice(start, matchIndex),
    match: cleanSource.slice(matchIndex, matchIndex + matchLen),
    after: cleanSource.slice(matchIndex + matchLen, end) + suffixEllipsis,
  };
}

export function buildSearchHits(
  allPages: NotePageRecord[],
  matchedPages: NotePageRecord[],
  rawQuery: string
): NoteSearchHit[] {
  const normalizedQuery = normalizeSearchText(rawQuery);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

  return matchedPages.map((page) => {
    const trail = getBreadcrumbTrail(allPages, page.id);
    const breadcrumb = trail.slice(0, -1).map((p) => getNoteDisplayTitle(p));
    const titleNorm = normalizeSearchText(normalizeEditableNoteTitle(page.title));
    const matchedInTitle =
      tokens.length > 0 && tokens.some((tok) => titleNorm.includes(tok));

    const bodyText = [
      getNotePreviewText(page),
      parseTagsText(page.tags),
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      page,
      breadcrumb,
      matchedInTitle,
      snippetParts: buildSnippetParts(bodyText, rawQuery),
    };
  });
}

export function computeNoteMetrics(
  contentMarkdown: string,
  blocksJson?: string | null
): NoteMetrics {
  const combined = [
    contentMarkdown,
    extractPlainTextFromBlocksJson(blocksJson),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (!combined) {
    return { wordCount: 0, readingMinutes: 0, charCount: 0 };
  }

  const words = combined.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));

  return {
    wordCount,
    readingMinutes,
    charCount: combined.length,
  };
}
