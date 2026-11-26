import {
  createBlock,
  serializeBlocksToMarkdown,
  type NoteBlock,
} from './noteBlocks';

export type NoteTemplateId =
  | 'journaling_3min'
  | 'weekly_review'
  | 'meeting_notes'
  | 'project_spec';

export interface NoteTemplateDefinition {
  id: NoteTemplateId;
  title: string;
  subtitle: string;
  icon: string;
  tags: string[];
  previewChips: string[];
}

export const NOTE_TEMPLATES: readonly NoteTemplateDefinition[] = [
  {
    id: 'journaling_3min',
    title: 'Journaling 3 min',
    subtitle: 'Claridad mental rápida: gratitud, prioridad única y cierre del día',
    icon: 'Lightbulb',
    tags: ['Journaling', 'Diario'],
    previewChips: ['Callout Enfoque', 'Checklist x3', 'Reflexión'],
  },
  {
    id: 'weekly_review',
    title: 'Revisión Semanal',
    subtitle: 'Balance semanal con victorias, aprendizajes y Top 3 accionables',
    icon: 'Compass',
    tags: ['Revisión', 'Semanal'],
    previewChips: ['Logros H2', 'Callout Idea', 'Top 3 → Hoy'],
  },
  {
    id: 'meeting_notes',
    title: 'Nota de Reunión',
    subtitle: 'Contexto en caja de cristal, acuerdos clave y tareas listas para enviar',
    icon: 'Briefcase',
    tags: ['Reunión', 'Trabajo'],
    previewChips: ['Contexto', 'Acuerdos', 'Acciones Checklist'],
  },
  {
    id: 'project_spec',
    title: 'Proyecto / Spec',
    subtitle: 'Especificación técnica con objetivo, bloque de código e hitos',
    icon: 'Rocket',
    tags: ['Proyecto', 'Spec'],
    previewChips: ['Objetivo Focus', 'Código', 'Hitos'],
  },
];

function formatShortTodayLabel(): string {
  try {
    return new Date().toLocaleDateString('es-CL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return 'Hoy';
  }
}

export function instantiateNoteTemplate(templateId: NoteTemplateId): {
  title: string;
  icon: string;
  tags: string[];
  blocks: NoteBlock[];
  contentMarkdown: string;
} {
  const dateLabel = formatShortTodayLabel();
  let title = 'Nueva Nota';
  let icon = 'FileText';
  let tags = ['Notas'];
  let blocks: NoteBlock[] = [];

  switch (templateId) {
    case 'journaling_3min':
      title = `Journaling · ${dateLabel}`;
      icon = 'Lightbulb';
      tags = ['Journaling', 'Diario'];
      blocks = [
        createBlock('callout', {
          tone: 'focus',
          text: 'Intención del día: ¿Cuál es la única cosa que hará que hoy valga la pena?',
        }),
        createBlock('h2', { text: '3 cosas por las que agradezco hoy' }),
        createBlock('checklist', { text: 'Salud, energía y claridad para avanzar' }),
        createBlock('checklist', { text: 'Un avance concreto en mis proyectos' }),
        createBlock('checklist', { text: 'Momento de calma o descanso consciente' }),
        createBlock('h2', { text: 'Nota rápida de mentalidad' }),
        createBlock('paragraph', {
          text: 'Hoy suelto distracciones y ejecuto con foco total en bloques cortos.',
        }),
      ];
      break;

    case 'weekly_review':
      title = `Revisión Semanal · ${dateLabel}`;
      icon = 'Compass';
      tags = ['Revisión', 'Semanal'];
      blocks = [
        createBlock('h2', { text: 'Victorias de la semana' }),
        createBlock('paragraph', { text: '• Lo que salió mejor de lo esperado:' }),
        createBlock('callout', {
          tone: 'idea',
          text: 'Aprendizaje clave / Ajuste para la próxima semana:',
        }),
        createBlock('h2', { text: 'Top 3 Prioridades (desliza a la derecha → Hoy)' }),
        createBlock('checklist', { text: 'Prioridad #1 de alto impacto' }),
        createBlock('checklist', { text: 'Prioridad #2 pendiente importante' }),
        createBlock('checklist', { text: 'Prioridad #3 orden / cierre' }),
      ];
      break;

    case 'meeting_notes':
      title = `Reunión · ${dateLabel}`;
      icon = 'Briefcase';
      tags = ['Reunión', 'Trabajo'];
      blocks = [
        createBlock('callout', {
          tone: 'info',
          text: 'Participantes & Objetivo: Definir alcance, responsables y fechas.',
        }),
        createBlock('h2', { text: 'Puntos tratados & Acuerdos' }),
        createBlock('paragraph', { text: '• Decisión 1:' }),
        createBlock('paragraph', { text: '• Decisión 2:' }),
        createBlock('h2', { text: 'Próximos pasos (envía directo a Hoy)' }),
        createBlock('checklist', { text: 'Enviar resumen y confirmar entregables' }),
        createBlock('checklist', { text: 'Agendar seguimiento en calendario' }),
      ];
      break;

    case 'project_spec':
      title = 'Spec de Proyecto';
      icon = 'Rocket';
      tags = ['Proyecto', 'Spec'];
      blocks = [
        createBlock('callout', {
          tone: 'focus',
          text: 'Objetivo central: Resolver un problema concreto con latencia cero y diseño mínimo.',
        }),
        createBlock('h2', { text: 'Arquitectura & Notas Técnicas' }),
        createBlock('code', {
          language: 'ts',
          text: '// Define contratos, rutas clave o pseudocódigo aquí\nexport const status = "ready";',
        }),
        createBlock('h2', { text: 'Hitos de Ejecución' }),
        createBlock('checklist', { text: 'Diseñar flujo principal y modelo de datos' }),
        createBlock('checklist', { text: 'Implementar MVP y verificar en Web + Móvil' }),
      ];
      break;
  }

  return {
    title,
    icon,
    tags,
    blocks,
    contentMarkdown: serializeBlocksToMarkdown(blocks),
  };
}
