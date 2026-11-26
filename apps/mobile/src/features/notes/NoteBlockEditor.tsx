import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import type { TaskRecord } from '@organiza/shared/schema';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Camera,
  Check,
  Checklist,
  CloudUpload,
  Code,
  Copy,
  DangerTriangle,
  Gallery,
  GalleryAdd,
  InfoCircle,
  Lightbulb,
  Link,
  ListCheck,
  Minus,
  Plus,
  Target,
  Trash2,
  X,
} from '../../components/icons';
import { radii, shadows, spacing, typography } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import {
  pickAndCompressImage,
  uploadCompressedImageToR2,
} from '../../services/mediaUpload';
import { copyTextToClipboard } from '../../utils/clipboard';
import {
  createBlock,
  detectLiveMarkdownShortcut,
  getNextCalloutTone,
  SLASH_BLOCK_COMMANDS,
  type CalloutTone,
  type NoteBlock,
  type NoteBlockType,
} from './noteBlocks';

export interface NoteBlockEditorProps {
  blocks: NoteBlock[];
  linkedTasksByBlockId: Record<string, TaskRecord>;
  headingColor: string;
  onChangeBlocks: (nextBlocks: NoteBlock[]) => void;
  onPromoteBlockToTask: (block: NoteBlock) => void;
  onOpenLinkedTask?: (task: TaskRecord) => void;
}

const CALLOUT_TONE_META: Record<
  CalloutTone,
  { label: string; icon: typeof Lightbulb }
> = {
  idea: { label: 'Idea', icon: Lightbulb },
  info: { label: 'Info', icon: InfoCircle },
  warning: { label: 'Alerta', icon: DangerTriangle },
  focus: { label: 'Enfoque', icon: Target },
};

const QUICK_ADD_BUTTONS: Array<{
  type: NoteBlockType;
  label: string;
}> = [
  { type: 'paragraph', label: 'Texto' },
  { type: 'h1', label: 'H1' },
  { type: 'h2', label: 'H2' },
  { type: 'checklist', label: 'Checklist' },
  { type: 'callout', label: 'Callout' },
  { type: 'code', label: 'Código' },
  { type: 'image', label: 'Imagen' },
  { type: 'divider', label: '---' },
];

const CODE_FONT = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

function syncWebTextareaHeight(node: TextInput | null, minHeight = 0) {
  if (Platform.OS !== 'web' || !node) return;
  const el = node as unknown as HTMLTextAreaElement | null;
  if (!el || el.tagName !== 'TEXTAREA' || !el.style) return;
  el.style.overflow = 'hidden';
  el.style.height = '0px';
  el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
}

export const NoteBlockEditor: React.FC<NoteBlockEditorProps> = ({
  blocks,
  linkedTasksByBlockId,
  headingColor,
  onChangeBlocks,
  onPromoteBlockToTask,
  onOpenLinkedTask,
}) => {
  const { theme, isDark } = useTheme();
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(
    blocks[0]?.id ?? null
  );
  const [copiedBlockId, setCopiedBlockId] = useState<string | null>(null);
  const [lightboxBlock, setLightboxBlock] = useState<NoteBlock | null>(null);
  const editorContainerRef = useRef<View>(null);
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});
  const pendingFocusIdRef = useRef<string | null>(null);
  const lastFocusedWebElRef = useRef<{
    el: HTMLInputElement | HTMLTextAreaElement;
    start: number | null;
    end: number | null;
    blurredAt: number;
  } | null>(null);
  const latestBlocksRef = useRef<NoteBlock[]>(blocks);
  latestBlocksRef.current = blocks;

  useEffect(() => {
    const targetId = pendingFocusIdRef.current;
    if (targetId && inputRefs.current[targetId]) {
      inputRefs.current[targetId]?.focus();
      pendingFocusIdRef.current = null;
    }
  }, [blocks]);

  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    for (const block of blocks) {
      syncWebTextareaHeight(
        inputRefs.current[block.id] ?? null,
        block.type === 'code' ? 54 : 0
      );
    }
  }, [blocks]);

  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      typeof window === 'undefined' ||
      typeof document === 'undefined'
    ) {
      return undefined;
    }

    const isInsideEditor = (node: EventTarget | null): node is HTMLInputElement | HTMLTextAreaElement => {
      const root = editorContainerRef.current as unknown as HTMLElement | null;
      if (!root || !(node instanceof HTMLElement)) return false;
      const isTextControl =
        node.tagName === 'TEXTAREA' || node.tagName === 'INPUT';
      return isTextControl && root.contains(node);
    };

    const captureSelection = (el: HTMLInputElement | HTMLTextAreaElement) => {
      try {
        return { start: el.selectionStart, end: el.selectionEnd };
      } catch {
        return { start: null, end: null };
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (isInsideEditor(event.target)) {
        const sel = captureSelection(event.target);
        lastFocusedWebElRef.current = {
          el: event.target,
          start: sel.start,
          end: sel.end,
          blurredAt: 0,
        };
      }
    };

    const handleFocusOut = (event: FocusEvent) => {
      const current = lastFocusedWebElRef.current;
      if (current && event.target === current.el) {
        const sel = captureSelection(current.el);
        lastFocusedWebElRef.current = {
          el: current.el,
          start: sel.start ?? current.start,
          end: sel.end ?? current.end,
          blurredAt: Date.now(),
        };
      }
    };

    const handleCapsLockEvent = (event: KeyboardEvent) => {
      if (event.key !== 'CapsLock' && event.code !== 'CapsLock') return;

      const active = document.activeElement;
      const tracked = lastFocusedWebElRef.current;
      let targetEl: HTMLInputElement | HTMLTextAreaElement | null = null;
      let sel: { start: number | null; end: number | null } = {
        start: null,
        end: null,
      };

      if (isInsideEditor(active)) {
        targetEl = active;
        sel = captureSelection(active);
      } else if (
        tracked &&
        tracked.el.isConnected &&
        Date.now() - tracked.blurredAt < 250 &&
        (active === null || active === document.body)
      ) {
        targetEl = tracked.el;
        sel = { start: tracked.start, end: tracked.end };
      }

      if (!targetEl) return;

      const restoreFocus = () => {
        if (!targetEl || !targetEl.isConnected) return;
        const nowActive = document.activeElement;
        if (nowActive === null || nowActive === document.body) {
          targetEl.focus({ preventScroll: true });
          if (sel.start !== null && sel.end !== null) {
            try {
              targetEl.setSelectionRange(sel.start, sel.end);
            } catch {
              // Ignorar si el input no soporta setSelectionRange
            }
          }
        }
      };

      requestAnimationFrame(restoreFocus);
      window.setTimeout(restoreFocus, 40);
    };

    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);
    window.addEventListener('keydown', handleCapsLockEvent, true);
    window.addEventListener('keyup', handleCapsLockEvent, true);
    return () => {
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focusout', handleFocusOut, true);
      window.removeEventListener('keydown', handleCapsLockEvent, true);
      window.removeEventListener('keyup', handleCapsLockEvent, true);
    };
  }, []);

  const bodyTextColor = headingColor;

  const updateBlockAt = (index: number, patch: Partial<NoteBlock>) => {
    const next = blocks.map((b, i) => (i === index ? { ...b, ...patch } : b));
    onChangeBlocks(next);
  };

  const updateBlockById = (blockId: string, patch: Partial<NoteBlock>) => {
    const current = latestBlocksRef.current;
    const next = current.map((b) => (b.id === blockId ? { ...b, ...patch } : b));
    latestBlocksRef.current = next;
    onChangeBlocks(next);
  };

  const insertBlockAfter = (
    index: number,
    type: NoteBlockType,
    initialText = ''
  ) => {
    const created = createBlock(type, { text: initialText });
    const next = [
      ...blocks.slice(0, index + 1),
      created,
      ...blocks.slice(index + 1),
    ];
    pendingFocusIdRef.current = created.id;
    setFocusedBlockId(created.id);
    onChangeBlocks(next);
    return created;
  };

  const handlePickAndUploadImageForBlock = async (
    targetBlockId: string,
    source: 'gallery' | 'camera' = 'gallery'
  ) => {
    const compressed = await pickAndCompressImage(source);
    if (!compressed) return;

    const sizeKb = Math.max(1, Math.round(compressed.sizeBytes / 1024));
    updateBlockById(targetBlockId, {
      type: 'image',
      imageUrl: compressed.dataUrl,
      imageSizeKb: sizeKb,
      imageStatus: 'uploading',
    });

    const uploaded = await uploadCompressedImageToR2(compressed);
    updateBlockById(targetBlockId, {
      imageUrl: uploaded.url,
      imageKey: uploaded.key || undefined,
      imageSizeKb: Math.max(1, Math.round(uploaded.sizeBytes / 1024)),
      imageStatus: uploaded.uploadedToR2 ? 'r2' : 'local',
    });
  };

  const handleInsertImageAfter = async (
    index: number,
    source: 'gallery' | 'camera' = 'gallery'
  ) => {
    const compressed = await pickAndCompressImage(source);
    if (!compressed) return;

    const sizeKb = Math.max(1, Math.round(compressed.sizeBytes / 1024));
    const imgBlock = createBlock('image', {
      imageUrl: compressed.dataUrl,
      imageSizeKb: sizeKb,
      imageStatus: 'uploading',
      caption: '',
      text: '',
    });

    const current = latestBlocksRef.current;
    const next = [
      ...current.slice(0, index + 1),
      imgBlock,
      ...current.slice(index + 1),
    ];
    latestBlocksRef.current = next;
    setFocusedBlockId(imgBlock.id);
    onChangeBlocks(next);

    const uploaded = await uploadCompressedImageToR2(compressed);
    updateBlockById(imgBlock.id, {
      imageUrl: uploaded.url,
      imageKey: uploaded.key || undefined,
      imageSizeKb: Math.max(1, Math.round(uploaded.sizeBytes / 1024)),
      imageStatus: uploaded.uploadedToR2 ? 'r2' : 'local',
    });
  };

  const handleRetryUploadToR2 = async (block: NoteBlock) => {
    if (!block.imageUrl || !block.imageUrl.startsWith('data:image/')) return;
    const match = block.imageUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) return;

    const contentType =
      match[1] === 'image/jpeg' ? ('image/jpeg' as const) : ('image/webp' as const);
    const base64 = match[2] ?? '';
    const sizeBytes = Math.floor((base64.length * 3) / 4);

    updateBlockById(block.id, { imageStatus: 'uploading' });
    const uploaded = await uploadCompressedImageToR2({
      dataUrl: block.imageUrl,
      base64,
      contentType,
      sizeBytes,
    });
    updateBlockById(block.id, {
      imageUrl: uploaded.url,
      imageKey: uploaded.key || undefined,
      imageSizeKb: Math.max(1, Math.round(uploaded.sizeBytes / 1024)),
      imageStatus: uploaded.uploadedToR2 ? 'r2' : 'local',
    });
  };

  const removeBlockAt = (index: number) => {
    if (blocks.length <= 1) {
      const reset = createBlock('paragraph', { text: '' });
      pendingFocusIdRef.current = reset.id;
      setFocusedBlockId(reset.id);
      onChangeBlocks([reset]);
      return;
    }
    const prevBlock = blocks[Math.max(0, index - 1)];
    const next = blocks.filter((_, i) => i !== index);
    if (prevBlock) {
      pendingFocusIdRef.current = prevBlock.id;
      setFocusedBlockId(prevBlock.id);
    }
    onChangeBlocks(next);
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    onChangeBlocks(next);
  };

  const handleTextChange = (index: number, block: NoteBlock, rawText: string) => {
    if (block.type === 'checklist' && rawText.includes('\n')) {
      const nlIdx = rawText.indexOf('\n');
      const before = rawText.slice(0, nlIdx);
      const after = rawText.slice(nlIdx + 1);

      if (!before.trim() && !after.trim()) {
        pendingFocusIdRef.current = block.id;
        setFocusedBlockId(block.id);
        updateBlockAt(index, { type: 'paragraph', text: '', checked: undefined });
        return;
      }

      const created = createBlock('checklist', { text: after });
      const next = [
        ...blocks.slice(0, index),
        { ...block, text: before },
        created,
        ...blocks.slice(index + 1),
      ];
      pendingFocusIdRef.current = created.id;
      setFocusedBlockId(created.id);
      onChangeBlocks(next);
      return;
    }

    const transformed = detectLiveMarkdownShortcut(block, rawText);
    if (transformed) {
      pendingFocusIdRef.current = transformed.id;
      const next = blocks.map((b, i) => (i === index ? transformed : b));
      onChangeBlocks(next);
      return;
    }

    updateBlockAt(index, { text: rawText });
  };

  const handleSlashSelect = (index: number, type: NoteBlockType) => {
    const current = blocks[index];
    if (!current) return;
    const converted = createBlock(type, { id: current.id, text: '' });
    const next = blocks.map((b, i) => (i === index ? converted : b));
    pendingFocusIdRef.current = converted.id;
    onChangeBlocks(next);
    if (type === 'image') {
      void handlePickAndUploadImageForBlock(current.id, 'gallery');
    }
  };

  const handleCopyCode = async (block: NoteBlock) => {
    const ok = await copyTextToClipboard(block.text);
    if (ok) {
      setCopiedBlockId(block.id);
      setTimeout(() => {
        setCopiedBlockId((prev) => (prev === block.id ? null : prev));
      }, 1600);
    }
  };

  const getCalloutColors = (tone: CalloutTone = 'idea') => {
    switch (tone) {
      case 'warning':
        return {
          bg: theme.warningSoft,
          border: 'rgba(245, 158, 11, 0.35)',
          icon: theme.warning,
        };
      case 'info':
        return {
          bg: isDark ? 'rgba(148, 154, 166, 0.14)' : 'rgba(15, 17, 21, 0.05)',
          border: theme.glassBorderStrong,
          icon: theme.textPrimary,
        };
      case 'focus':
      case 'idea':
      default:
        return {
          bg: theme.accentPrimarySoft,
          border: theme.accentPrimaryBorder,
          icon: theme.accentPrimaryLink,
        };
    }
  };

  const activeBlockIndex = useMemo(
    () => blocks.findIndex((b) => b.id === focusedBlockId),
    [blocks, focusedBlockId]
  );

  return (
    <View ref={editorContainerRef} style={styles.container}>
      {/* Pista discreta de atajos Markdown */}
      <View
        style={[
          styles.hintsStrip,
          { backgroundColor: theme.cardElevated, borderColor: theme.glassBorder },
        ]}
      >
        <Text style={[styles.hintText, { color: theme.textMuted }]}>
          Atajos:{' '}
          <Text style={[styles.hintCode, { color: theme.textPrimary }]}># </Text>
          H1 ·{' '}
          <Text style={[styles.hintCode, { color: theme.textPrimary }]}>- [ ] </Text>
          Checklist ·{' '}
          <Text style={[styles.hintCode, { color: theme.textPrimary }]}>&gt; </Text>
          Callout ·{' '}
          <Text style={[styles.hintCode, { color: theme.textPrimary }]}>```</Text>{' '}
          Código ·{' '}
          <Text style={[styles.hintCode, { color: theme.accentPrimaryLink }]}>/</Text>{' '}
          Menú
          {Platform.OS === 'web'
            ? ' · Pega fotos con Ctrl/Cmd+V'
            : ' · Desliza → para Hoy'}
        </Text>
      </View>

      {/* Lista de bloques */}
      <View style={styles.blocksList}>
        {blocks.map((block, index) => {
          const isFocused = focusedBlockId === block.id;
          const linkedTask = linkedTasksByBlockId[block.id];
          const canSendToToday =
            (block.type === 'paragraph' || block.type === 'checklist') &&
            block.text.trim().length > 0;

          const showSlashMenu =
            isFocused &&
            block.type === 'paragraph' &&
            block.text.startsWith('/') &&
            !block.text.includes('\n');
          const slashQuery = showSlashMenu
            ? block.text.slice(1).toLowerCase().trim()
            : '';
          const slashCommands = showSlashMenu
            ? SLASH_BLOCK_COMMANDS.filter(
                (cmd) =>
                  !slashQuery ||
                  cmd.label.toLowerCase().includes(slashQuery) ||
                  cmd.slash.toLowerCase().includes(slashQuery)
              )
            : [];

          const renderBlockToolbar = () => {
            if (!isFocused && !linkedTask) return null;
            return (
              <View style={styles.blockToolbarRow}>
                {linkedTask ? (
                  <Pressable
                    onPress={() => onOpenLinkedTask?.(linkedTask)}
                    style={[
                      styles.linkedPill,
                      {
                        backgroundColor: linkedTask.isCompleted
                          ? theme.successSoft
                          : theme.accentPrimarySoft,
                        borderColor: linkedTask.isCompleted
                          ? 'rgba(52, 211, 153, 0.35)'
                          : theme.accentPrimaryBorder,
                      },
                    ]}
                  >
                    <Link
                      size={11}
                      color={
                        linkedTask.isCompleted
                          ? theme.success
                          : theme.accentPrimaryLink
                      }
                      strokeWidth={2}
                    />
                    <Text
                      style={[
                        styles.linkedPillText,
                        {
                          color: linkedTask.isCompleted
                            ? theme.success
                            : theme.accentPrimaryLink,
                        },
                      ]}
                    >
                      {linkedTask.isCompleted ? 'Hecha en Hoy' : 'En Hoy →'}
                    </Text>
                  </Pressable>
                ) : canSendToToday && isFocused ? (
                  <Pressable
                    onPress={() => onPromoteBlockToTask(block)}
                    style={[
                      styles.sendTodayBtn,
                      {
                        backgroundColor: theme.accentPrimarySoft,
                        borderColor: theme.accentPrimaryBorder,
                      },
                    ]}
                  >
                    <Checklist size={12} color={theme.accentPrimaryLink} />
                    <Text
                      style={[
                        styles.sendTodayText,
                        { color: theme.accentPrimaryLink },
                      ]}
                    >
                      Enviar a Hoy
                    </Text>
                  </Pressable>
                ) : null}

                {isFocused ? (
                  <View style={styles.blockOrderBtns}>
                    <Pressable
                      onPress={() => moveBlock(index, -1)}
                      disabled={index === 0}
                      hitSlop={6}
                      style={[
                        styles.miniToolBtn,
                        {
                          backgroundColor: theme.pillBg,
                          opacity: index === 0 ? 0.35 : 1,
                        },
                      ]}
                    >
                      <ArrowUp size={11} color={theme.textSecondary} strokeWidth={2} />
                    </Pressable>
                    <Pressable
                      onPress={() => moveBlock(index, 1)}
                      disabled={index === blocks.length - 1}
                      hitSlop={6}
                      style={[
                        styles.miniToolBtn,
                        {
                          backgroundColor: theme.pillBg,
                          opacity: index === blocks.length - 1 ? 0.35 : 1,
                        },
                      ]}
                    >
                      <ArrowDown size={11} color={theme.textSecondary} strokeWidth={2} />
                    </Pressable>
                    <Pressable
                      onPress={() => removeBlockAt(index)}
                      hitSlop={6}
                      style={[
                        styles.miniToolBtn,
                        { backgroundColor: theme.dangerSoft },
                      ]}
                    >
                      <Trash2 size={11} color={theme.danger} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          };

          const renderInnerBlock = () => {
            if (block.type === 'image') {
              const hasImage = Boolean(block.imageUrl);
              const isLocalFallback =
                block.imageStatus === 'local' &&
                Boolean(block.imageUrl?.startsWith('data:image/'));
              const statusLabel =
                block.imageStatus === 'uploading'
                  ? 'Subiendo a Cloudflare R2...'
                  : block.imageStatus === 'r2'
                    ? `R2${block.imageSizeKb ? ` · ${block.imageSizeKb} KB WebP` : ''}`
                    : `Local${block.imageSizeKb ? ` · ${block.imageSizeKb} KB WebP` : ''}`;

              return (
                <View
                  style={[
                    styles.imageCard,
                    {
                      backgroundColor: theme.cardElevated,
                      borderColor: isFocused
                        ? theme.accentPrimaryBorder
                        : theme.glassBorder,
                    },
                  ]}
                >
                  {hasImage ? (
                    <>
                      <Pressable
                        onPress={() => setLightboxBlock(block)}
                        style={styles.imagePreviewWrap}
                      >
                        <Image
                          source={{ uri: block.imageUrl }}
                          style={styles.imagePreview}
                          resizeMode="cover"
                        />
                      </Pressable>

                      <View style={styles.imageFooterRow}>
                        <View
                          style={[
                            styles.imageStatusPill,
                            {
                              backgroundColor:
                                block.imageStatus === 'r2'
                                  ? theme.successSoft
                                  : theme.accentPrimarySoft,
                            },
                          ]}
                        >
                          <Gallery
                            size={12}
                            color={
                              block.imageStatus === 'r2'
                                ? theme.success
                                : theme.accentPrimaryLink
                            }
                          />
                          <Text
                            style={[
                              styles.imageStatusText,
                              {
                                color:
                                  block.imageStatus === 'r2'
                                    ? theme.success
                                    : theme.accentPrimaryLink,
                              },
                            ]}
                          >
                            {statusLabel}
                          </Text>
                        </View>

                        <View style={styles.imageActionsRight}>
                          {isLocalFallback ? (
                            <Pressable
                              onPress={() => void handleRetryUploadToR2(block)}
                              style={[
                                styles.retryR2Btn,
                                {
                                  backgroundColor: theme.pillBg,
                                  borderColor: theme.glassBorder,
                                },
                              ]}
                            >
                              <CloudUpload size={12} color={theme.textPrimary} />
                              <Text
                                style={[
                                  styles.retryR2Text,
                                  { color: theme.textPrimary },
                                ]}
                              >
                                Subir R2
                              </Text>
                            </Pressable>
                          ) : null}

                          <Pressable
                            onPress={() =>
                              void handlePickAndUploadImageForBlock(block.id, 'gallery')
                            }
                            style={[
                              styles.miniToolBtn,
                              { backgroundColor: theme.pillBg },
                            ]}
                          >
                            <GalleryAdd size={12} color={theme.textSecondary} />
                          </Pressable>

                          <Pressable
                            onPress={() => removeBlockAt(index)}
                            style={[
                              styles.miniToolBtn,
                              { backgroundColor: theme.dangerSoft },
                            ]}
                          >
                            <Trash2 size={12} color={theme.danger} />
                          </Pressable>
                        </View>
                      </View>

                      <TextInput
                        value={block.caption ?? block.text ?? ''}
                        onFocus={() => setFocusedBlockId(block.id)}
                        onChangeText={(cap) =>
                          updateBlockAt(index, { caption: cap, text: cap })
                        }
                        placeholder="Pie de foto o nota sobre la imagen..."
                        placeholderTextColor={theme.textMuted}
                        style={[styles.captionInput, { color: theme.textSecondary }]}
                      />
                    </>
                  ) : (
                    <View style={styles.imagePickEmpty}>
                      <Gallery size={22} color={theme.accentPrimaryLink} />
                      <Text style={[styles.imagePickTitle, { color: theme.textPrimary }]}>
                        Adjuntar imagen comprimida (~80 KB WebP)
                      </Text>
                      <View style={styles.imagePickButtons}>
                        <Pressable
                          onPress={() =>
                            void handlePickAndUploadImageForBlock(block.id, 'gallery')
                          }
                          style={[
                            styles.imagePickBtn,
                            { backgroundColor: theme.accentPrimary },
                          ]}
                        >
                          <GalleryAdd size={14} color="#FFFFFF" />
                          <Text style={styles.imagePickBtnText}>Galería</Text>
                        </Pressable>

                        {Platform.OS !== 'web' ? (
                          <Pressable
                            onPress={() =>
                              void handlePickAndUploadImageForBlock(block.id, 'camera')
                            }
                            style={[
                              styles.imagePickBtnOutline,
                              {
                                backgroundColor: theme.pillBg,
                                borderColor: theme.glassBorder,
                              },
                            ]}
                          >
                            <Camera size={14} color={theme.textPrimary} />
                            <Text
                              style={[
                                styles.imagePickOutlineText,
                                { color: theme.textPrimary },
                              ]}
                            >
                              Cámara
                            </Text>
                          </Pressable>
                        ) : null}

                        <Pressable
                          onPress={() => removeBlockAt(index)}
                          style={[
                            styles.miniToolBtn,
                            { backgroundColor: theme.dangerSoft },
                          ]}
                        >
                          <Trash2 size={12} color={theme.danger} />
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            }

            if (block.type === 'divider') {
              return (
                <Pressable
                  onPress={() => setFocusedBlockId(block.id)}
                  style={styles.dividerRow}
                >
                  <View
                    style={[styles.dividerLine, { backgroundColor: theme.divider }]}
                  />
                  {isFocused ? (
                    <Pressable
                      onPress={() => removeBlockAt(index)}
                      hitSlop={8}
                      style={[
                        styles.miniToolBtn,
                        { backgroundColor: theme.dangerSoft },
                      ]}
                    >
                      <Trash2 size={11} color={theme.danger} />
                    </Pressable>
                  ) : null}
                </Pressable>
              );
            }

            if (block.type === 'code') {
              const isCopied = copiedBlockId === block.id;
              return (
                <View
                  style={[
                    styles.codeCard,
                    {
                      backgroundColor: isDark ? '#0D0F13' : '#14161A',
                      borderColor: isFocused
                        ? theme.accentPrimaryBorder
                        : theme.glassBorderStrong,
                    },
                  ]}
                >
                  <View style={styles.codeHeader}>
                    <View style={styles.codeHeaderLeft}>
                      <Code size={13} color={theme.accentPrimaryLink} />
                      <TextInput
                        value={block.language ?? 'ts'}
                        onChangeText={(lang) =>
                          updateBlockAt(index, { language: lang })
                        }
                        onFocus={() => setFocusedBlockId(block.id)}
                        placeholder="lang"
                        placeholderTextColor="#7A808D"
                        style={styles.codeLangInput}
                      />
                    </View>

                    <View style={styles.codeHeaderRight}>
                      <Pressable
                        onPress={() => void handleCopyCode(block)}
                        style={[
                          styles.copyCodeBtn,
                          {
                            backgroundColor: isCopied
                              ? 'rgba(52, 211, 153, 0.16)'
                              : 'rgba(255, 255, 255, 0.08)',
                          },
                        ]}
                      >
                        {isCopied ? (
                          <Check size={12} color="#34D399" strokeWidth={2.2} />
                        ) : (
                          <Copy size={12} color="#F5F7FA" />
                        )}
                        <Text
                          style={[
                            styles.copyCodeText,
                            { color: isCopied ? '#34D399' : '#F5F7FA' },
                          ]}
                        >
                          {isCopied ? 'Copiado' : 'Copiar'}
                        </Text>
                      </Pressable>

                      {isFocused ? (
                        <Pressable
                          onPress={() => removeBlockAt(index)}
                          hitSlop={6}
                          style={styles.codeDeleteBtn}
                        >
                          <Trash2 size={12} color="#FA6B6B" />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>

                  <TextInput
                    ref={(el) => {
                      inputRefs.current[block.id] = el;
                      syncWebTextareaHeight(el, 54);
                    }}
                    value={block.text}
                    onFocus={() => setFocusedBlockId(block.id)}
                    onChangeText={(txt) => {
                      handleTextChange(index, block, txt);
                      if (Platform.OS === 'web') {
                        requestAnimationFrame(() =>
                          syncWebTextareaHeight(inputRefs.current[block.id] ?? null, 54)
                        );
                      }
                    }}
                    placeholder="// Escribe código o comandos aquí..."
                    placeholderTextColor="#6E7480"
                    multiline
                    blurOnSubmit={false}
                    textAlignVertical="top"
                    style={[styles.codeInput, { fontFamily: CODE_FONT }]}
                  />
                </View>
              );
            }

            if (block.type === 'callout') {
              const tone = block.tone ?? 'idea';
              const toneColors = getCalloutColors(tone);
              const ToneIcon = CALLOUT_TONE_META[tone].icon;

              return (
                <View
                  style={[
                    styles.calloutCard,
                    {
                      backgroundColor: toneColors.bg,
                      borderColor: toneColors.border,
                    },
                  ]}
                >
                  <Pressable
                    onPress={() =>
                      updateBlockAt(index, { tone: getNextCalloutTone(tone) })
                    }
                    accessibilityLabel="Cambiar estilo de Callout"
                    style={[
                      styles.calloutIconBtn,
                      { backgroundColor: theme.card },
                    ]}
                  >
                    <ToneIcon size={17} color={toneColors.icon} />
                  </Pressable>

                  <View style={styles.calloutBody}>
                    <View style={styles.calloutTop}>
                      <Text
                        style={[styles.calloutToneTag, { color: toneColors.icon }]}
                      >
                        {CALLOUT_TONE_META[tone].label.toUpperCase()}
                      </Text>
                      {isFocused ? (
                        <Pressable
                          onPress={() => removeBlockAt(index)}
                          hitSlop={8}
                        >
                          <Trash2 size={12} color={theme.textMuted} />
                        </Pressable>
                      ) : null}
                    </View>
                    <TextInput
                      ref={(el) => {
                        inputRefs.current[block.id] = el;
                        syncWebTextareaHeight(el);
                      }}
                      value={block.text}
                      onFocus={() => setFocusedBlockId(block.id)}
                      onChangeText={(txt) => {
                        handleTextChange(index, block, txt);
                        if (Platform.OS === 'web') {
                          requestAnimationFrame(() =>
                            syncWebTextareaHeight(inputRefs.current[block.id] ?? null)
                          );
                        }
                      }}
                      placeholder="Idea destacada o recordatorio visual..."
                      placeholderTextColor={theme.textMuted}
                      multiline
                      numberOfLines={Platform.OS === 'web' ? 1 : undefined}
                      blurOnSubmit={false}
                      style={[styles.calloutInput, { color: bodyTextColor }]}
                    />
                  </View>
                </View>
              );
            }

            if (block.type === 'checklist') {
              const checked = Boolean(block.checked);
              return (
                <View style={styles.blockWrap}>
                  <View style={styles.checklistRow}>
                    <Pressable
                      onPress={() => updateBlockAt(index, { checked: !checked })}
                      hitSlop={8}
                      style={[
                        styles.checkboxBox,
                        {
                          backgroundColor: checked
                            ? theme.accentPrimary
                            : 'transparent',
                          borderColor: checked
                            ? theme.accentPrimary
                            : theme.glassBorderStrong,
                        },
                      ]}
                    >
                      {checked ? (
                        <Check size={13} color="#FFFFFF" strokeWidth={2.5} />
                      ) : null}
                    </Pressable>

                    <TextInput
                      ref={(el) => {
                        inputRefs.current[block.id] = el;
                        syncWebTextareaHeight(el);
                      }}
                      value={block.text}
                      onFocus={() => setFocusedBlockId(block.id)}
                      onChangeText={(txt) => {
                        handleTextChange(index, block, txt);
                        if (Platform.OS === 'web') {
                          requestAnimationFrame(() =>
                            syncWebTextareaHeight(inputRefs.current[block.id] ?? null)
                          );
                        }
                      }}
                      placeholder="Tarea dentro de esta nota..."
                      placeholderTextColor={theme.textMuted}
                      multiline
                      numberOfLines={Platform.OS === 'web' ? 1 : undefined}
                      blurOnSubmit={false}
                      style={[
                        styles.checklistInput,
                        { color: checked ? theme.textMuted : bodyTextColor },
                        checked && styles.strikethroughText,
                      ]}
                    />
                  </View>
                  {renderBlockToolbar()}
                </View>
              );
            }

            const typographyStyle =
              block.type === 'h1'
                ? styles.h1Input
                : block.type === 'h2'
                  ? styles.h2Input
                  : block.type === 'h3'
                    ? styles.h3Input
                    : styles.paragraphInput;

            const placeholderText =
              block.type === 'h1'
                ? 'Título H1'
                : block.type === 'h2'
                  ? 'Subtítulo H2'
                  : block.type === 'h3'
                    ? 'Sección H3'
                    : index === 0
                      ? 'Escribe aquí, o usa # , - [ ] , > , ``` o / ...'
                      : 'Escribe o presiona / para comandos...';

            return (
              <View style={styles.blockWrap}>
                <TextInput
                  ref={(el) => {
                    inputRefs.current[block.id] = el;
                    syncWebTextareaHeight(el);
                  }}
                  value={block.text}
                  onFocus={() => setFocusedBlockId(block.id)}
                  onChangeText={(txt) => {
                    handleTextChange(index, block, txt);
                    if (Platform.OS === 'web') {
                      requestAnimationFrame(() =>
                        syncWebTextareaHeight(inputRefs.current[block.id] ?? null)
                      );
                    }
                  }}
                  placeholder={placeholderText}
                  placeholderTextColor={theme.textMuted}
                  multiline
                  numberOfLines={Platform.OS === 'web' ? 1 : undefined}
                  blurOnSubmit={false}
                  style={[typographyStyle, { color: bodyTextColor }]}
                />

                {showSlashMenu && slashCommands.length > 0 ? (
                  <View
                    style={[
                      styles.slashMenu,
                      {
                        backgroundColor: theme.cardElevated,
                        borderColor: theme.glassBorderStrong,
                      },
                    ]}
                  >
                    <Text style={[styles.slashMenuTitle, { color: theme.textMuted }]}>
                      INSERTAR BLOQUE
                    </Text>
                    {slashCommands.map((cmd) => (
                      <Pressable
                        key={cmd.type}
                        onPress={() => handleSlashSelect(index, cmd.type)}
                        style={({ pressed }) => [
                          styles.slashMenuItem,
                          pressed && { backgroundColor: theme.hoverBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.slashMenuCmd,
                            { color: theme.accentPrimaryLink },
                          ]}
                        >
                          {cmd.slash}
                        </Text>
                        <Text
                          style={[styles.slashMenuLabel, { color: theme.textPrimary }]}
                        >
                          {cmd.label}
                        </Text>
                        <Text
                          style={[styles.slashMenuHint, { color: theme.textMuted }]}
                        >
                          {cmd.hint}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {renderBlockToolbar()}
              </View>
            );
          };

          const content = renderInnerBlock();
          const supportsSwipe =
            Platform.OS !== 'web' &&
            (block.type === 'paragraph' || block.type === 'checklist');
          const swipeEnabled = supportsSwipe && block.text.trim().length > 0;

          if (!supportsSwipe) {
            return (
              <View key={block.id} style={styles.blockRowShell}>
                {content}
              </View>
            );
          }

          return (
            <Swipeable
              key={block.id}
              ref={(el) => {
                swipeableRefs.current[block.id] = el;
              }}
              enabled={swipeEnabled}
              overshootLeft={false}
              leftThreshold={48}
              onSwipeableOpen={(direction) => {
                if (direction === 'left') {
                  onPromoteBlockToTask(block);
                  swipeableRefs.current[block.id]?.close();
                }
              }}
              renderLeftActions={
                swipeEnabled
                  ? () => (
                      <View
                        style={[
                          styles.swipeHoyAction,
                          { backgroundColor: theme.accentPrimary },
                        ]}
                      >
                        <ListCheck size={16} color="#FFFFFF" />
                        <Text style={styles.swipeHoyText}>Enviar a Hoy</Text>
                        <ArrowRight size={14} color="#FFFFFF" strokeWidth={2.2} />
                      </View>
                    )
                  : undefined
              }
            >
              <View
                style={[
                  styles.blockRowShell,
                  { backgroundColor: theme.card },
                ]}
              >
                {content}
              </View>
            </Swipeable>
          );
        })}
      </View>

      {/* Barra inferior rápida + Bloque */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.addBarRow,
          { borderTopColor: theme.divider },
        ]}
      >
        <View style={styles.addBarPrefix}>
          <Plus size={12} color={theme.accentPrimaryLink} strokeWidth={2.2} />
          <Text style={[styles.addBarLabel, { color: theme.textMuted }]}>
            Bloque:
          </Text>
        </View>
        {QUICK_ADD_BUTTONS.map((btn) => (
          <Pressable
            key={btn.type}
            onPress={() => {
              const targetIdx =
                activeBlockIndex >= 0 ? activeBlockIndex : blocks.length - 1;
              if (btn.type === 'image') {
                void handleInsertImageAfter(targetIdx, 'gallery');
              } else {
                insertBlockAfter(targetIdx, btn.type);
              }
            }}
            style={({ pressed }) => [
              styles.addBarChip,
              {
                backgroundColor: theme.pillBg,
                borderColor: theme.glassBorder,
                opacity: pressed ? 0.78 : 1,
              },
            ]}
          >
            {btn.type === 'divider' ? (
              <Minus size={12} color={theme.textSecondary} strokeWidth={2} />
            ) : btn.type === 'image' ? (
              <GalleryAdd size={12} color={theme.accentPrimaryLink} />
            ) : null}
            <Text style={[styles.addBarChipText, { color: theme.textPrimary }]}>
              {btn.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Visor Lightbox de Imagen a pantalla completa */}
      <Modal
        visible={Boolean(lightboxBlock?.imageUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxBlock(null)}
      >
        <Pressable
          style={styles.lightboxBackdrop}
          onPress={() => setLightboxBlock(null)}
        >
          <Pressable
            style={[styles.lightboxInner, shadows.floatingDock]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.lightboxTopBar}>
              <Text style={styles.lightboxMeta}>
                {lightboxBlock?.imageStatus === 'r2' ? 'Cloudflare R2' : 'Copia Local'}
                {lightboxBlock?.imageSizeKb
                  ? ` · ${lightboxBlock.imageSizeKb} KB WebP`
                  : ''}
              </Text>
              <Pressable
                onPress={() => setLightboxBlock(null)}
                style={styles.lightboxCloseBtn}
              >
                <X size={18} color="#FFFFFF" strokeWidth={2.2} />
              </Pressable>
            </View>
            {lightboxBlock?.imageUrl ? (
              <Image
                source={{ uri: lightboxBlock.imageUrl }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />
            ) : null}
            {lightboxBlock?.caption ? (
              <Text style={styles.lightboxCaption}>{lightboxBlock.caption}</Text>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  hintsStrip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  hintText: {
    fontSize: 11,
    lineHeight: 16,
    ...typography.caption,
  },
  hintCode: {
    ...typography.bodySemiBold,
  },
  blocksList: {
    gap: 8,
  },
  blockRowShell: {
    borderRadius: radii.md,
  },
  blockWrap: {
    gap: 4,
    paddingVertical: 2,
  },
  h1Input: {
    fontSize: 22,
    lineHeight: 28,
    paddingVertical: 4,
    ...typography.docTitle,
  },
  h2Input: {
    fontSize: 18,
    lineHeight: 24,
    paddingVertical: 3,
    ...typography.heading2,
  },
  h3Input: {
    fontSize: 15,
    lineHeight: 21,
    paddingVertical: 2,
    ...typography.heading3,
  },
  paragraphInput: {
    fontSize: 15,
    lineHeight: 24,
    paddingVertical: 3,
    ...typography.body,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 3,
  },
  checkboxBox: {
    width: 21,
    height: 21,
    marginTop: 2,
    borderRadius: 7,
    borderCurve: 'continuous',
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 23,
    paddingVertical: 0,
    ...typography.body,
  },
  strikethroughText: {
    textDecorationLine: 'line-through',
  },
  calloutCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 12,
  },
  calloutIconBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.squircle,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutBody: {
    flex: 1,
    gap: 2,
  },
  calloutTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calloutToneTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  calloutInput: {
    fontSize: 14,
    lineHeight: 21,
    paddingVertical: 2,
    ...typography.bodyMedium,
  },
  codeCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  codeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeLangInput: {
    color: '#949AA6',
    fontSize: 11,
    fontWeight: '700',
    minWidth: 42,
    paddingVertical: 0,
  },
  codeHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  copyCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  copyCodeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  codeDeleteBtn: {
    padding: 4,
  },
  codeInput: {
    color: '#F5F7FA',
    fontSize: 13,
    lineHeight: 20,
    minHeight: 54,
    paddingVertical: 2,
  },
  imageCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  imagePreviewWrap: {
    width: '100%',
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 220,
    borderRadius: radii.md,
  },
  imageFooterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  imageStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  imageStatusText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  imageActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  retryR2Btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  retryR2Text: {
    fontSize: 11,
    fontWeight: '700',
  },
  captionInput: {
    fontSize: 12,
    paddingVertical: 2,
    ...typography.caption,
  },
  imagePickEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  imagePickTitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  imagePickButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  imagePickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  imagePickBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  imagePickBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  imagePickOutlineText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  blockToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    paddingTop: 2,
  },
  linkedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  linkedPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sendTodayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  sendTodayText: {
    fontSize: 10,
    fontWeight: '700',
  },
  blockOrderBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  miniToolBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slashMenu: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 6,
    gap: 2,
    marginTop: 4,
  },
  slashMenuTitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  slashMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
  },
  slashMenuCmd: {
    fontSize: 11,
    fontWeight: '700',
    width: 62,
  },
  slashMenuLabel: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  slashMenuHint: {
    fontSize: 11,
  },
  swipeHoyAction: {
    borderRadius: radii.md,
    paddingHorizontal: 14,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swipeHoyText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  addBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  addBarPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 2,
  },
  addBarLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  addBarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  addBarChipText: {
    fontSize: 11,
    ...typography.bodyMedium,
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  lightboxInner: {
    width: '100%',
    maxWidth: 880,
    gap: spacing.sm,
  },
  lightboxTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lightboxMeta: {
    color: '#D4D7DF',
    fontSize: 12,
    fontWeight: '600',
  },
  lightboxCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: {
    width: '100%',
    height: 480,
    borderRadius: radii.md,
  },
  lightboxCaption: {
    color: '#F5F7FA',
    fontSize: 13,
    textAlign: 'center',
  },
});

export default NoteBlockEditor;
