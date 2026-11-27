import { useCallback, useRef, useState } from 'react';
import type { NoteBlock } from './noteBlocks';

export interface NoteHistorySnapshot {
  title: string;
  blocks: NoteBlock[];
}

export interface NoteHistoryRecordResult {
  pushed: boolean;
  deletedBlock: boolean;
  largeTextDeletion: boolean;
}

interface PageHistoryBucket {
  past: NoteHistorySnapshot[];
  future: NoteHistorySnapshot[];
  lastPushAt: number;
  lastEditKind: 'typing' | 'discrete' | null;
  lastTargetKey: string | null;
}

interface ChangeClassification {
  kind: 'none' | 'upload_meta' | 'typing' | 'discrete';
  targetKey: string;
  deletedBlock: boolean;
  largeTextDeletion: boolean;
}

const MAX_HISTORY_STEPS = 50;
const TYPING_COALESCE_MS = 900;

function cloneBlocks(blocks: NoteBlock[]): NoteBlock[] {
  return blocks.map((block) => ({ ...block }));
}

function cloneSnapshot(snapshot: NoteHistorySnapshot): NoteHistorySnapshot {
  return {
    title: snapshot.title,
    blocks: cloneBlocks(snapshot.blocks),
  };
}

function areBlocksEqual(a: NoteBlock, b: NoteBlock): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.text === b.text &&
    a.checked === b.checked &&
    a.tone === b.tone &&
    a.language === b.language &&
    a.linkedTaskId === b.linkedTaskId &&
    a.imageUrl === b.imageUrl &&
    a.imageKey === b.imageKey &&
    a.imageSizeKb === b.imageSizeKb &&
    a.imageStatus === b.imageStatus &&
    a.caption === b.caption
  );
}

function areSnapshotsEqual(
  a: NoteHistorySnapshot,
  b: NoteHistorySnapshot
): boolean {
  if (a.title !== b.title || a.blocks.length !== b.blocks.length) {
    return false;
  }
  for (let i = 0; i < a.blocks.length; i += 1) {
    const prevBlock = a.blocks[i];
    const nextBlock = b.blocks[i];
    if (!prevBlock || !nextBlock || !areBlocksEqual(prevBlock, nextBlock)) {
      return false;
    }
  }
  return true;
}

function isImageUploadFinalizationOnly(
  prev: NoteHistorySnapshot,
  next: NoteHistorySnapshot
): boolean {
  if (prev.title !== next.title || prev.blocks.length !== next.blocks.length) {
    return false;
  }

  let hasUploadTransition = false;

  for (let i = 0; i < prev.blocks.length; i += 1) {
    const p = prev.blocks[i];
    const n = next.blocks[i];
    if (!p || !n) return false;

    const coreEqual =
      p.id === n.id &&
      p.type === n.type &&
      p.text === n.text &&
      p.caption === n.caption &&
      p.checked === n.checked &&
      p.tone === n.tone &&
      p.language === n.language &&
      p.linkedTaskId === n.linkedTaskId;

    if (!coreEqual) {
      return false;
    }

    if (!areBlocksEqual(p, n)) {
      if (p.imageStatus !== 'uploading') {
        return false;
      }
      hasUploadTransition = true;
    }
  }

  return hasUploadTransition;
}

function classifyChange(
  prev: NoteHistorySnapshot,
  next: NoteHistorySnapshot
): ChangeClassification {
  if (areSnapshotsEqual(prev, next)) {
    return {
      kind: 'none',
      targetKey: 'none',
      deletedBlock: false,
      largeTextDeletion: false,
    };
  }

  if (isImageUploadFinalizationOnly(prev, next)) {
    return {
      kind: 'upload_meta',
      targetKey: 'upload',
      deletedBlock: false,
      largeTextDeletion: false,
    };
  }

  const prevSingle = prev.blocks[0];
  const nextSingle = next.blocks[0];
  const replacedSingleNonEmptyBlock =
    prev.blocks.length === 1 &&
    next.blocks.length === 1 &&
    prevSingle !== undefined &&
    nextSingle !== undefined &&
    prevSingle.id !== nextSingle.id &&
    (Boolean(prevSingle.text.trim()) ||
      Boolean(prevSingle.imageUrl) ||
      prevSingle.type === 'divider' ||
      prevSingle.type === 'code' ||
      prevSingle.type === 'callout');

  const deletedBlock =
    next.blocks.length < prev.blocks.length || replacedSingleNonEmptyBlock;

  const titleChanged = prev.title !== next.title;
  const blocksEqual =
    prev.blocks.length === next.blocks.length &&
    prev.blocks.every((b, idx) => {
      const other = next.blocks[idx];
      return other !== undefined && areBlocksEqual(b, other);
    });

  if (titleChanged && blocksEqual) {
    const prevLen = prev.title.length;
    const nextLen = next.title.length;
    const delta = prevLen - nextLen;
    const largeTextDeletion =
      delta >= 20 ||
      (prev.title.trim().length >= 8 && next.title.trim().length === 0);
    const isSignificantDelete = delta >= 8 || (prevLen > 1 && nextLen === 0);

    return {
      kind: largeTextDeletion || isSignificantDelete ? 'discrete' : 'typing',
      targetKey: 'title',
      deletedBlock: false,
      largeTextDeletion,
    };
  }

  if (!titleChanged && prev.blocks.length === next.blocks.length) {
    const changedIndices: number[] = [];
    for (let i = 0; i < prev.blocks.length; i += 1) {
      const p = prev.blocks[i];
      const n = next.blocks[i];
      if (!p || !n || !areBlocksEqual(p, n)) {
        changedIndices.push(i);
      }
    }

    if (changedIndices.length === 1) {
      const idx = changedIndices[0]!;
      const p = prev.blocks[idx]!;
      const n = next.blocks[idx]!;
      const sameNonTextProps =
        p.id === n.id &&
        p.type === n.type &&
        p.checked === n.checked &&
        p.tone === n.tone &&
        p.language === n.language &&
        p.linkedTaskId === n.linkedTaskId &&
        p.imageUrl === n.imageUrl &&
        p.imageKey === n.imageKey &&
        p.imageSizeKb === n.imageSizeKb &&
        p.imageStatus === n.imageStatus;

      if (sameNonTextProps) {
        const prevText =
          p.type === 'image' ? (p.caption ?? p.text ?? '') : p.text;
        const nextText =
          n.type === 'image' ? (n.caption ?? n.text ?? '') : n.text;
        const delta = prevText.length - nextText.length;
        const largeTextDeletion =
          delta >= 20 ||
          (prevText.trim().length >= 8 && nextText.trim().length === 0);
        const isSignificantDelete =
          delta >= 8 || (prevText.length > 1 && nextText.length === 0);

        return {
          kind:
            largeTextDeletion || isSignificantDelete ? 'discrete' : 'typing',
          targetKey: `block:${p.id}`,
          deletedBlock: false,
          largeTextDeletion,
        };
      }
    }
  }

  const prevTotalText = prev.blocks.reduce(
    (sum, b) => sum + b.text.length + (b.caption?.length ?? 0),
    0
  );
  const nextTotalText = next.blocks.reduce(
    (sum, b) => sum + b.text.length + (b.caption?.length ?? 0),
    0
  );
  const largeTextDeletion =
    prev.title.length - next.title.length >= 20 ||
    (prev.title.trim().length >= 8 && next.title.trim().length === 0) ||
    prevTotalText - nextTotalText >= 20;

  return {
    kind: 'discrete',
    targetKey: 'structure',
    deletedBlock,
    largeTextDeletion,
  };
}

function createEmptyBucket(): PageHistoryBucket {
  return {
    past: [],
    future: [],
    lastPushAt: 0,
    lastEditKind: null,
    lastTargetKey: null,
  };
}

/**
 * Historial por documento (Deshacer / Rehacer) para proteger contenido ante borrados accidentales.
 */
export function useNoteHistory(pageId: string | null) {
  const historyByPageRef = useRef<Record<string, PageHistoryBucket>>({});
  const [version, setVersion] = useState(0);

  const getOrCreateBucket = (targetPageId: string): PageHistoryBucket => {
    let bucket = historyByPageRef.current[targetPageId];
    if (!bucket) {
      bucket = createEmptyBucket();
      historyByPageRef.current[targetPageId] = bucket;
    }
    return bucket;
  };

  const recordChange = useCallback(
    (
      targetPageId: string,
      prev: NoteHistorySnapshot,
      next: NoteHistorySnapshot
    ): NoteHistoryRecordResult => {
      const classification = classifyChange(prev, next);
      if (
        classification.kind === 'none' ||
        classification.kind === 'upload_meta'
      ) {
        return {
          pushed: false,
          deletedBlock: false,
          largeTextDeletion: false,
        };
      }

      const bucket = getOrCreateBucket(targetPageId);
      const now = Date.now();
      const shouldPush =
        classification.kind === 'discrete' ||
        bucket.past.length === 0 ||
        bucket.lastEditKind !== 'typing' ||
        bucket.lastTargetKey !== classification.targetKey ||
        now - bucket.lastPushAt > TYPING_COALESCE_MS;

      if (shouldPush) {
        bucket.past.push(cloneSnapshot(prev));
        if (bucket.past.length > MAX_HISTORY_STEPS) {
          bucket.past.splice(0, bucket.past.length - MAX_HISTORY_STEPS);
        }
      }

      bucket.future = [];
      bucket.lastPushAt = now;
      bucket.lastEditKind = classification.kind;
      bucket.lastTargetKey = classification.targetKey;

      setVersion((v) => v + 1);

      return {
        pushed: shouldPush,
        deletedBlock: classification.deletedBlock,
        largeTextDeletion: classification.largeTextDeletion,
      };
    },
    []
  );

  const undo = useCallback(
    (
      targetPageId: string,
      current: NoteHistorySnapshot
    ): NoteHistorySnapshot | null => {
      const bucket = historyByPageRef.current[targetPageId];
      if (!bucket || bucket.past.length === 0) {
        return null;
      }

      const restored = bucket.past.pop()!;
      bucket.future.push(cloneSnapshot(current));
      if (bucket.future.length > MAX_HISTORY_STEPS) {
        bucket.future.splice(0, bucket.future.length - MAX_HISTORY_STEPS);
      }

      bucket.lastEditKind = null;
      bucket.lastTargetKey = null;
      bucket.lastPushAt = 0;

      setVersion((v) => v + 1);
      return cloneSnapshot(restored);
    },
    []
  );

  const redo = useCallback(
    (
      targetPageId: string,
      current: NoteHistorySnapshot
    ): NoteHistorySnapshot | null => {
      const bucket = historyByPageRef.current[targetPageId];
      if (!bucket || bucket.future.length === 0) {
        return null;
      }

      const restored = bucket.future.pop()!;
      bucket.past.push(cloneSnapshot(current));
      if (bucket.past.length > MAX_HISTORY_STEPS) {
        bucket.past.splice(0, bucket.past.length - MAX_HISTORY_STEPS);
      }

      bucket.lastEditKind = null;
      bucket.lastTargetKey = null;
      bucket.lastPushAt = 0;

      setVersion((v) => v + 1);
      return cloneSnapshot(restored);
    },
    []
  );

  void version;
  const activeBucket = pageId ? historyByPageRef.current[pageId] : undefined;
  const undoCount = activeBucket?.past.length ?? 0;
  const canUndo = undoCount > 0;
  const canRedo = (activeBucket?.future.length ?? 0) > 0;

  return {
    canUndo,
    canRedo,
    undoCount,
    recordChange,
    undo,
    redo,
  };
}
