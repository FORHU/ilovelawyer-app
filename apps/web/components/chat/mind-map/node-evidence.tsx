import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, FileText, XCircle } from 'lucide-react';
import type { MindMapItem } from '@/lib/chat/mind-map-parser';

/**
 * A node's evidence in the mind map's detail panel: the case documents it cites, and — once Jev
 * has checked it (ilovelawyer-api mind-map-jev.ts) — whether the cited passage bears it out and
 * what that passage amounts to (a party's allegation, a witness's account, a document,
 * established). The case's document-built map only; chat maps cite nothing.
 */
export function NodeEvidence({ item, documentNames }: { item: MindMapItem; documentNames?: Record<string, string> }) {
  const { t } = useTranslation('case-portfolio');
  const describe = (documentId: string, page?: number) => {
    const name = documentNames?.[documentId] ?? (documentNames ? t('mindMapCheck.removedDocument') : '');
    return [name, page ? t('mindMapCheck.page', { page }) : ''].filter(Boolean).join(', ');
  };

  const check = item.check;
  const verdictLine = check
    ? {
        SUPPORTED: { Icon: CheckCircle2, tone: 'text-emerald-700 dark:text-emerald-400', text: t('mindMapCheck.supportedBy', { source: describe(check.documentId, check.page) }) },
        UNSUPPORTED: { Icon: AlertTriangle, tone: 'text-amber-700 dark:text-amber-400', text: t('mindMapCheck.notFoundIn', { source: describe(check.documentId, check.page) }) },
        CONTRADICTED: { Icon: XCircle, tone: 'text-red-700 dark:text-red-400', text: t('mindMapCheck.contradictedBy', { source: describe(check.documentId, check.page) }) },
      }[check.verdict]
    : null;

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      {item.sourceRemoved && (
        <div className="flex items-start gap-2 text-[13px] font-medium text-slate-600 dark:text-slate-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{t('mindMapCheck.sourceRemovedDetail')}</span>
        </div>
      )}
      {verdictLine && check && (
        <div className={`flex items-start gap-2 text-[13px] font-medium ${verdictLine.tone}`}>
          <verdictLine.Icon size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <span>
              {verdictLine.text}
              {check.verdict !== 'UNSUPPORTED' && ` · ${t(`mindMapCheck.kind.${check.evidenceKind}`, { defaultValue: check.evidenceKind })}`}
            </span>
            {!check.located && <span className="text-[12px] font-normal text-muted-foreground">{t('mindMapCheck.fallback')}</span>}
          </div>
        </div>
      )}
      {item.sources && item.sources.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">{t('mindMapCheck.sources')}</span>
          <ul className="flex flex-col gap-1">
            {item.sources.map((source, i) => (
              <li key={`${source.documentId}-${source.page ?? i}`} className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <FileText size={13} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{describe(source.documentId, source.page) || source.documentId}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
