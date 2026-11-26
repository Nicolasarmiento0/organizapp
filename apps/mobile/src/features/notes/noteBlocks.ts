import type { NotePageRecord } from '@organiza/shared/schema';
import { createLocalId } from '../../db/seedData';

export type NoteBlockType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'checklist'
  | 'callout'
  | 'code'
  | 'divider'
  | 'image';

export type CalloutTone = 'idea' | 'info' | 'warning' | 'focus';

export type ImageUploadStatus = 'uploading' | 'r2' | 'local';

export interface NoteBlock {
  id: string;
  type: NoteBlockType;
  text: string;
  checked?: boolean;
  tone?: CalloutTone;
  language?: string;
  linkedTaskId?: string | null;
  imageUrl?: string;
  imageKey?: string;
  imageSizeKb?: number;
  imageStatus?: ImageUploadStatus;
  caption?: string;
}

export interface SlashBlockCommand {
  type: NoteBlockType;
  slash: string;
  label: string;
  hint: string;
}

export const SLASH_BLOCK_COMMANDS: readonly SlashBlockCommand[] = [
  { type: 'paragraph', slash: '/texto', label: 'Texto', hint: 'Párrafo limpio' },
  { type: 'h1', slash: '/h1', label: 'Título H1', hint: 'Atajo: # ' },
  { type: 'h2', slash: '/h2', label: 'Subtítulo H2', hint: 'Atajo: ## ' },
  { type: 'h3', slash: '/h3', label: 'Sección H3', hint: 'Atajo: ### ' },
  { type: 'checklist', slash: '/check', label: 'Checklist', hint: 'Atajo: - [ ] ' },
  { type: 'callout', slash: '/callout', label: 'Callout Cristal', hint: 'Atajo: > ' },
  { type: 'code', slash: '/code', label: 'Bloque de Código', hint: 'Atajo: ```' },
  { type: 'image', slash: '/imagen', label: 'Imagen (WebP ~80KB)', hint: 'Galería → Cloudflare R2' },
  { type: 'divider', slash: '/sep', label: 'Separador', hint: 'Atajo: ---' },
];

export const CALLOUT_TONE_ORDER: readonly CalloutTone[] = [
  'idea',
  'info',
  'warning',
  'focus',
];

export function getNextCalloutTone(current?: CalloutTone): CalloutTone {
  const idx = current ? CALLOUT_TONE_ORDER.indexOf(current) : -1;
  return CALLOUT_TONE_ORDER[(idx + 1) % CALLOUT_TONE_ORDER.length] ?? 'idea';
}

export function createBlock(
  type: NoteBlockType,
  partial: Partial<NoteBlock> = {}
): NoteBlock {
  return {
    id: partial.id ?? createLocalId(),
    type,
    text: partial.text ?? '',
    checked: type === 'checklist' ? Boolean(partial.checked) : partial.checked,
    tone: type === 'callout' ? partial.tone ?? 'idea' : partial.tone,
    language: type === 'code' ? partial.language ?? 'ts' : partial.language,
    linkedTaskId: partial.linkedTaskId ?? null,
    imageUrl: partial.imageUrl,
    imageKey: partial.imageKey,
    imageSizeKb: partial.imageSizeKb,
    imageStatus: partial.imageStatus,
    caption: partial.caption,
  };
}

/**
 * Convierte Markdown estándar a bloques híbridos ligeros.
 */
export function parseMarkdownToBlocks(markdown: string): NoteBlock[] {
  const normalized = (markdown ?? '').replace(/\r\n/g, '\n');
  if (!normalized.trim()) {
    return [createBlock('paragraph', { text: '' })];
  }

  const lines = normalized.split('\n');
  const blocks: NoteBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Bloque de código con ```
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim() || 'text';
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? '').trim().startsWith('```')) {
        codeLines.push(lines[i] ?? '');
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push(
        createBlock('code', {
          text: codeLines.join('\n'),
          language,
        })
      );
      continue;
    }

    // Separador ---
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push(createBlock('divider'));
      i += 1;
      continue;
    }

    // Imagen Markdown ![caption](url)
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      const caption = imageMatch[1] ?? '';
      const imageUrl = imageMatch[2] ?? '';
      blocks.push(
        createBlock('image', {
          caption,
          text: caption,
          imageUrl,
          imageStatus: imageUrl.startsWith('data:') ? 'local' : 'r2',
        })
      );
      i += 1;
      continue;
    }

    // Encabezados H1, H2, H3
    if (line.startsWith('### ')) {
      blocks.push(createBlock('h3', { text: line.slice(4) }));
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(createBlock('h2', { text: line.slice(3) }));
      i += 1;
      continue;
    }
    if (line.startsWith('# ')) {
      blocks.push(createBlock('h1', { text: line.slice(2) }));
      i += 1;
      continue;
    }

    // Checklists `- [ ]` o `- [x]`
    const checkMatch = line.match(/^\s*[-*]\s+\[([ xX])\]\s*(.*)$/);
    if (checkMatch) {
      blocks.push(
        createBlock('checklist', {
          checked: (checkMatch[1] ?? '').toLowerCase() === 'x',
          text: checkMatch[2] ?? '',
        })
      );
      i += 1;
      continue;
    }

    // Callouts `> ...` con soporte opcional `[!idea|info|warning|focus]`
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i] ?? '').startsWith('>')) {
        quoteLines.push((lines[i] ?? '').replace(/^>\s?/, ''));
        i += 1;
      }
      let joined = quoteLines.join('\n').trim();
      let tone: CalloutTone = 'idea';
      const toneMatch = joined.match(/^\[!(idea|info|warning|focus)\]\s*/i);
      if (toneMatch) {
        tone = (toneMatch[1] ?? 'idea').toLowerCase() as CalloutTone;
        joined = joined.slice(toneMatch[0].length);
      }
      blocks.push(createBlock('callout', { text: joined, tone }));
      continue;
    }

    // Lista simple `- texto` o párrafo normal
    const bulletText = line.startsWith('- ') ? `• ${line.slice(2)}` : line;
    blocks.push(createBlock('paragraph', { text: bulletText }));
    i += 1;
  }

  return blocks.length > 0 ? blocks : [createBlock('paragraph', { text: '' })];
}

export function serializeBlocksToMarkdown(blocks: NoteBlock[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'h1':
        parts.push(`# ${block.text}`);
        break;
      case 'h2':
        parts.push(`## ${block.text}`);
        break;
      case 'h3':
        parts.push(`### ${block.text}`);
        break;
      case 'checklist':
        parts.push(`- [${block.checked ? 'x' : ' '}] ${block.text}`);
        break;
      case 'callout': {
        const prefix = block.tone && block.tone !== 'idea' ? `[!${block.tone}] ` : '';
        const body = `${prefix}${block.text}`
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n');
        parts.push(body);
        break;
      }
      case 'code':
        parts.push(`\`\`\`${block.language || ''}\n${block.text}\n\`\`\``);
        break;
      case 'image':
        if (block.imageUrl) {
          const cap = (block.caption ?? block.text ?? '').trim();
          parts.push(`![${cap}](${block.imageUrl})`);
        }
        break;
      case 'divider':
        parts.push('---');
        break;
      case 'paragraph':
      default:
        parts.push(block.text);
        break;
    }
  }

  return parts.join('\n\n');
}

export function loadBlocksForPage(
  page: Pick<NotePageRecord, 'blocksJson' | 'contentMarkdown'>
): NoteBlock[] {
  if (page.blocksJson) {
    try {
      const parsed = JSON.parse(page.blocksJson) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((raw) => {
          const item = (raw && typeof raw === 'object' ? raw : {}) as Partial<NoteBlock>;
          const type: NoteBlockType =
            item.type &&
            [
              'paragraph',
              'h1',
              'h2',
              'h3',
              'checklist',
              'callout',
              'code',
              'divider',
              'image',
            ].includes(item.type)
              ? item.type
              : 'paragraph';
          return createBlock(type, item);
        });
      }
    } catch {
      // Fallback directo a Markdown
    }
  }

  return parseMarkdownToBlocks(page.contentMarkdown);
}

/**
 * Detecta atajos Markdown en vivo mientras el usuario escribe dentro de un párrafo.
 */
export function detectLiveMarkdownShortcut(
  block: NoteBlock,
  nextText: string
): NoteBlock | null {
  if (block.type !== 'paragraph' || nextText.includes('\n')) return null;

  if (nextText.startsWith('### ')) {
    return { ...block, type: 'h3', text: nextText.slice(4) };
  }
  if (nextText.startsWith('## ')) {
    return { ...block, type: 'h2', text: nextText.slice(3) };
  }
  if (nextText.startsWith('# ')) {
    return { ...block, type: 'h1', text: nextText.slice(2) };
  }
  if (nextText.startsWith('- [ ] ') || nextText.startsWith('[] ')) {
    const rest = nextText.startsWith('- [ ] ')
      ? nextText.slice(6)
      : nextText.slice(3);
    return { ...block, type: 'checklist', checked: false, text: rest };
  }
  if (nextText.startsWith('- [x] ') || nextText.startsWith('[x] ')) {
    const rest = nextText.startsWith('- [x] ')
      ? nextText.slice(6)
      : nextText.slice(4);
    return { ...block, type: 'checklist', checked: true, text: rest };
  }
  if (nextText.startsWith('> ')) {
    return { ...block, type: 'callout', tone: 'idea', text: nextText.slice(2) };
  }
  if (nextText.startsWith('```')) {
    const lang = nextText.slice(3).trim() || 'ts';
    return { ...block, type: 'code', language: lang, text: '' };
  }
  if (nextText.trim() === '---') {
    return { ...block, type: 'divider', text: '' };
  }

  return null;
}

export function computeChecklistProgress(blocks: NoteBlock[]): {
  done: number;
  total: number;
} {
  let done = 0;
  let total = 0;
  for (const b of blocks) {
    if (b.type === 'checklist') {
      total += 1;
      if (b.checked) done += 1;
    }
  }
  return { done, total };
}
