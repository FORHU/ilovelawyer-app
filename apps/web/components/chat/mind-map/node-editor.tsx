import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import type { MindMapEditRequest } from './types';
import { MIND_MAP_LIMITS } from './constants';

interface NodeEditorProps {
  node: { id: string; label: string; description?: string; depth: number; childCount: number; descendantCount: number };
  /** Resolves with the node the change landed on, or null when the save failed (the hook
   * already showed why). */
  onEdit: (edit: MindMapEditRequest) => Promise<string | null>;
  /** After a successful save — the map itself refreshes through its data; this is for the
   * panel/canvas to follow (close on delete, open the parent on add). */
  onSaved: (edit: MindMapEditRequest) => void;
  /** Whole-map reasons nothing can be changed right now (a rebuild/reply in flight). */
  disabledReason?: string;
  atNodeCap: boolean;
}

type Mode = 'idle' | 'rename' | 'add' | 'delete';

/**
 * Rename / add a point / delete, for one node in the mind map's detail panel. Saves through the
 * API (ilovelawyer-api MindMapSvc.editNode) as an undoable revision — the canvas has no editing
 * of its own. Same shape rules as the API: nothing on the root, the five top-level branches
 * can't be deleted, and adding respects MIND_MAP_LIMITS.
 */
export function NodeEditor({ node, onEdit, onSaved, disabledReason, atNodeCap }: NodeEditorProps) {
  const { t } = useTranslation('case-portfolio');
  const [mode, setMode] = useState<Mode>('idle');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const canDelete = node.depth > 1;
  const canAdd = node.depth < MIND_MAP_LIMITS.maxDepth && !atNodeCap;

  const open = (next: Mode) => {
    setMode(next);
    setLabel(next === 'rename' ? node.label : '');
    setDescription(next === 'rename' ? node.description ?? '' : '');
  };

  const submit = async (edit: MindMapEditRequest) => {
    setSaving(true);
    const landedOn = await onEdit(edit);
    setSaving(false);
    if (landedOn) {
      setMode('idle');
      onSaved(edit);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-gold/40';
  const ghostBtn =
    'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:pointer-events-none';

  if (mode === 'idle') {
    return (
      <div className="flex flex-wrap items-center gap-1" title={disabledReason}>
        <button type="button" className={ghostBtn} disabled={Boolean(disabledReason)} onClick={() => open('rename')}>
          <Pencil size={12} /> {t('mindMapEdit.rename')}
        </button>
        {canAdd && (
          <button type="button" className={ghostBtn} disabled={Boolean(disabledReason)} onClick={() => open('add')}>
            <Plus size={12} /> {t('mindMapEdit.addPoint')}
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            className={`${ghostBtn} hover:text-red-600 dark:hover:text-red-400`}
            disabled={Boolean(disabledReason)}
            onClick={() => open('delete')}
          >
            <Trash2 size={12} /> {t('mindMapEdit.delete')}
          </button>
        )}
      </div>
    );
  }

  if (mode === 'delete') {
    return (
      <div role="alertdialog" aria-labelledby={`mind-map-delete-${node.id}`} className="flex flex-col gap-3">
        <p id={`mind-map-delete-${node.id}`} className="text-[13px] leading-snug text-foreground">
          {node.descendantCount > 0
            ? t('mindMapEdit.confirmDeleteWithChildren', { label: node.label, count: node.descendantCount })
            : t('mindMapEdit.confirmDelete', { label: node.label })}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className={ghostBtn} onClick={() => setMode('idle')} disabled={saving}>
            {t('mindMapExpand.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void submit({ op: 'delete', nodeId: node.id })}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            {t('mindMapEdit.delete')}
          </button>
        </div>
      </div>
    );
  }

  const trimmed = label.trim();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed) return;
        void submit({ op: mode, nodeId: node.id, label: trimmed, description: description.trim() });
      }}
    >
      <label className="sr-only" htmlFor={`mind-map-${mode}-label-${node.id}`}>
        {t('mindMapEdit.labelPlaceholder')}
      </label>
      <input
        id={`mind-map-${mode}-label-${node.id}`}
        autoFocus
        maxLength={120}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={t('mindMapEdit.labelPlaceholder')}
        className={inputClass}
      />
      <label className="sr-only" htmlFor={`mind-map-${mode}-description-${node.id}`}>
        {t('mindMapEdit.descriptionPlaceholder')}
      </label>
      <textarea
        id={`mind-map-${mode}-description-${node.id}`}
        rows={3}
        maxLength={2000}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t('mindMapEdit.descriptionPlaceholder')}
        className={`${inputClass} resize-y`}
      />
      <div className="flex justify-end gap-2">
        <button type="button" className={ghostBtn} onClick={() => setMode('idle')} disabled={saving}>
          {t('mindMapExpand.cancel')}
        </button>
        <button
          type="submit"
          disabled={saving || !trimmed}
          className="flex items-center gap-1.5 rounded-lg bg-brand-navy-950 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#162244] disabled:opacity-60"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          {mode === 'add' ? t('mindMapEdit.addPoint') : t('mindMapEdit.save')}
        </button>
      </div>
    </form>
  );
}
