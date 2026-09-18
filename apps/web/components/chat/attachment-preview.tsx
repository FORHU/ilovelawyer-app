"use client";

import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import xlsxPreview from "xlsx-preview";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  isDocxAttachment,
  isImageAttachment,
  isLegacyDocAttachment,
  isPdfAttachment,
  isXlsxAttachment,
  type MessageAttachment,
} from "@/components/chat/message-attachments";
import { apiFetch } from "@/lib/fetch";

interface AttachmentPreviewProps {
  attachment: MessageAttachment;
}

// xlsx-preview's genColor() (src/CSSStyles/inline.ts) converts a cell's ARGB font/fill color
// straight to CSS: `rgba(r,g,b,${a/255})`, trusting the alpha byte the workbook stored. Real
// spreadsheet tools routinely write that byte as 00 for perfectly ordinary, fully-visible colors
// — Excel itself never exposes or honors per-cell alpha, so writers treat that byte as a "don't
// care" and some zero it out — but xlsx-preview takes it literally, producing `rgba(31,58,95,0)`:
// fully transparent, i.e. invisible, for any cell whose color happened to be written that way.
// Confirmed directly against the actual uploaded file (not a guess): every styled cell in it
// carries alpha 0 this way, which is why headers/labels/bold cells were unreadable regardless of
// app theme, independent of and in addition to the dark-mode-inherited-color issue fixed below —
// an inline `style="color:rgba(...,0)"` on the <td> itself overrides any ancestor text color.
// Rewriting alpha-0 to alpha-1 here is the only place to fix it, short of patching node_modules.
function fixTransparentCellColors(html: string): string {
  return html.replace(/rgba\((\d+,\s*\d+,\s*\d+),\s*0\)/g, "rgba($1,1)");
}

/** The actual preview surface for a Message Attachment (ADR 0012) — PDFs render inline via the
 * browser's native viewer, images via a plain `<img>`, .docx via docx-preview and .xlsx/.xlsm/
 * .xlam via xlsx-preview (all client-side, file bytes never leave the browser — unlike a
 * third-party embed viewer such as Office/Google, which would send a potentially confidential
 * document's URL to that party; deliberately not used here). Legacy binary .doc has no
 * client-parseable format at all, so it instead shows a plain-text extraction fetched from the
 * backend (GET /documents/:id/text-preview). Legacy .xls and everything else no viewer here can
 * render fall back to a filename + Download action instead.
 *
 * Deliberately just the preview surface, no surrounding chrome (title bar, close button,
 * backdrop) — FilePreviewModal wraps this for the chat attachment-chip modal, and
 * DocumentFolderBrowser embeds it directly (with its own back-navigation header) for Studio's
 * inline Documents preview, so neither has to duplicate the fetch/render logic below. Fills its
 * parent's height — the caller decides whether that's a modal's fixed h-[80vh] body or a
 * resizable sidebar's available height. */
export function AttachmentPreview({ attachment }: AttachmentPreviewProps) {
  const { t } = useTranslation("homepage");
  const [inlineFailed, setInlineFailed] = useState(false);
  const isPdf = isPdfAttachment(attachment);
  const isImage = isImageAttachment(attachment);
  const isDocx = isDocxAttachment(attachment);
  const isXlsx = isXlsxAttachment(attachment);
  const isLegacyDoc = isLegacyDocAttachment(attachment);
  // Seeded from the initial attachment (which never changes across this component's lifetime —
  // every caller only renders it behind `{x && <AttachmentPreview .../>}`, so a new attachment
  // always remounts rather than updating props) instead of set synchronously inside the render
  // effect below, since setState in an effect's synchronous body triggers an avoidable extra
  // cascading render.
  const [docxLoading, setDocxLoading] = useState(() => isDocx && !!attachment.url);
  const docxContainerRef = useRef<HTMLDivElement>(null);
  const [xlsxLoading, setXlsxLoading] = useState(() => isXlsx && !!attachment.url);
  const [xlsxSheets, setXlsxSheets] = useState<string[] | null>(null);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  // Text preview needs only attachment.id (a real backend Document id) — unlike docx/xlsx it
  // never fetches the S3 blob directly, so it works even for the url-less pre-persisted chip
  // state other previews can't render (see MessageAttachment's `url` doc comment).
  const [docLoading, setDocLoading] = useState(() => isLegacyDoc);
  const [docText, setDocText] = useState<string | null>(null);

  const canInlinePreview = (isPdf || isImage) && !!attachment.url && !inlineFailed;
  const canDocxPreview = isDocx && !!attachment.url && !inlineFailed;
  const canXlsxPreview = isXlsx && !!attachment.url && !inlineFailed;
  const canDocTextPreview = isLegacyDoc && !inlineFailed;

  // docx-preview renders imperatively into a live DOM node rather than taking React props, so
  // this fetches the bytes and hands them off once per attachment. Requires the presigned S3
  // URL's bucket to allow cross-origin GETs (fetch() enforces CORS, unlike the plain <img>/
  // <iframe> src= loads below) — a fetch failure here (CORS or otherwise) falls back to
  // Download exactly like a parse failure would.
  useEffect(() => {
    if (!isDocx || !attachment.url) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(attachment.url!);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        const container = docxContainerRef.current;
        if (!container) return;
        container.innerHTML = "";
        await renderAsync(blob, container, undefined, { ignoreWidth: true, ignoreHeight: true });
        // docx-preview's own injected stylesheet (not our CSS) wraps every page it renders in a
        // "paper on a mat" look: `.docx-wrapper { background: gray; padding: 30px 0 0; }` plus
        // `.docx-wrapper>section.docx { box-shadow: 0 0 10px rgba(0,0,0,.5); margin-bottom: 30px; }`.
        // Making the wrapper transparent still left the box-shadow's own blur visible as a gray
        // band across the top (shadows render regardless of what's behind them) and the 30px
        // padding as a blank gap before the page starts — neither is our CSS, both are DOM
        // docx-preview built itself, so overriding them here (inline styles beat its stylesheet
        // regardless of injection order) is the only way to reach them and get the bare document
        // with none of that framing.
        const wrapper = container.querySelector<HTMLElement>(".docx-wrapper");
        if (wrapper) {
          wrapper.style.background = "transparent";
          wrapper.style.padding = "0";
        }
        container.querySelectorAll<HTMLElement>(".docx-wrapper > section.docx").forEach((page) => {
          page.style.boxShadow = "none";
        });
      } catch {
        if (!cancelled) setInlineFailed(true);
      } finally {
        if (!cancelled) setDocxLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDocx, attachment.url]);

  // Same fetch-then-render shape as the docx effect above, and the same CORS caveat applies.
  //
  // `separateSheets: true` is deliberate — xlsx-preview's DEFAULT output (no separateSheets) is
  // not a plain <table>: it wraps every sheet in an `<object data="blob:...">` embed, plus a
  // sheet-name tab bar and locate arrows, plus an inline <script> wiring their click handlers.
  // None of that survives being embedded via dangerouslySetInnerHTML into a live page: the
  // <script> tag never executes at all (browsers don't run script markup inserted via innerHTML,
  // so the tab buttons' click handlers were simply never attached), the tab bar's own CSS is
  // `position: fixed; left: 0; bottom: 0` — written assuming its output owns the whole page, so
  // it pinned to the browser viewport's own corner instead of this container's — and even once
  // repositioned, an `<object>` (like an iframe) is a separate rendering surface that visually
  // sits on top of overlapping siblings regardless of z-index, so its own scrollbar chrome still
  // intercepted clicks meant for the tab buttons beneath it. `separateSheets: true` sidesteps
  // all of it: it returns one plain, script-free HTML string per sheet (no object, no fixed
  // positioning), and the sheet-switcher below is built with normal React state and buttons
  // instead of fighting markup that was never meant to be embedded this way.
  useEffect(() => {
    if (!isXlsx || !attachment.url) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(attachment.url!);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        // Defaults pad every sheet out to a 20-row x 16-col grid regardless of how much real
        // data it has (minimumRows/minimumCols) — fine for mimicking Excel's own infinite-grid
        // look, but for a short sheet (a one-page metadata table, say) it renders a wall of
        // blank padded rows/columns past the real content. 1/1 is as close to "off" as this
        // library lets us get: its own `xlsx2Html` only calls setMinimumNumberRows/Cols when
        // `options.minimumRows`/`minimumCols` is truthy (`if (options?.minimumRows) {...}`), so
        // passing 0 — falsy — silently no-ops and leaves it at its built-in default of 20/16
        // (confirmed by direct testing: 0/0 still produced a 20-row table). 1 is truthy, so it
        // actually takes effect, and Math.max(realLastRow, 1) is a no-op for any sheet that has
        // real data — only an entirely empty sheet would ever see 1 row of padding from this.
        const sheets = (await xlsxPreview.xlsx2Html(blob, {
          minimumRows: 1,
          minimumCols: 1,
          separateSheets: true,
        })) as string[];
        if (cancelled) return;
        setXlsxSheets(sheets.map(fixTransparentCellColors));
      } catch {
        if (!cancelled) setInlineFailed(true);
      } finally {
        if (!cancelled) setXlsxLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isXlsx, attachment.url]);

  // Legacy .doc has no client-parseable format at all (see isLegacyDocAttachment), so unlike
  // docx/xlsx above this never fetches file bytes itself — it asks the backend to run the same
  // word-extractor pass the RAG pipeline already uses and just renders the resulting text.
  useEffect(() => {
    if (!isLegacyDoc) return;
    let cancelled = false;
    (async () => {
      try {
        const { text } = await apiFetch<{ text: string }>(`/api/documents/${attachment.id}/text-preview`);
        if (cancelled) return;
        setDocText(text);
      } catch {
        if (!cancelled) setInlineFailed(true);
      } finally {
        if (!cancelled) setDocLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLegacyDoc, attachment.id]);

  return (
    <div className="h-full min-h-0 bg-muted/30">
      {canInlinePreview && isImage ? (
        <div className="flex h-full items-center justify-center p-4">
          <img
            src={attachment.url!}
            alt={attachment.name}
            className="max-h-full max-w-full object-contain"
            onError={() => setInlineFailed(true)}
          />
        </div>
      ) : canInlinePreview ? (
        <iframe
          // PDF Open Parameters fragment (Adobe spec, honored by Chrome/Edge's built-in PDFium
          // viewer and Firefox's pdf.js) — without it the native viewer opens at its own default
          // zoom, which on a narrow mobile width renders the page wider than the iframe with no
          // way to zoom out first, so it never fits the screen. FitH forces "fit to width" so the
          // page always starts scaled to the frame and only needs vertical scroll.
          src={isPdf ? `${attachment.url!}#view=FitH` : attachment.url!}
          title={attachment.name}
          className="h-full w-full touch-pan-y border-0"
          onError={() => setInlineFailed(true)}
        />
      ) : canDocxPreview ? (
        <div className="h-full overflow-y-auto bg-white p-4 sm:p-8">
          {docxLoading && (
            // text-neutral-500, not text-muted-foreground — this wrapper is forced bg-white
            // regardless of app theme (see below), and dark mode's --muted-foreground resolves
            // to near-white, which read as invisible against it.
            <div className="flex h-full items-center justify-center gap-2 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t("attachment.loadingPreview")}
            </div>
          )}
          {/* docx-preview renders its own white "page" styling regardless of app theme — matches
           * a real Word document's appearance, same reasoning as the PDF iframe above always
           * showing the PDF's own (usually white) background. This wrapper used to add a gray/
           * dark page-mat backdrop behind it (a Google-Docs-viewer look), but embedded in a
           * narrow sidebar that just read as a mismatched solid-color box sitting behind the
           * document — plain white here instead, same as xlsx's wrapper below. Hidden rather
           * than unmounted while loading so the ref stays attached for renderAsync to target. */}
          <div ref={docxContainerRef} className={docxLoading ? "hidden" : "mx-auto max-w-3xl"} />
        </div>
      ) : canXlsxPreview ? (
        <div className="flex h-full flex-col">
          {xlsxLoading ? (
            // text-neutral-500, not text-muted-foreground — same theme-token-on-forced-white
            // issue as the tab row/table below (dark mode's --muted-foreground is near-white).
            <div className="flex h-full items-center justify-center gap-2 bg-white text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t("attachment.loadingPreview")}
            </div>
          ) : (
            <>
              {/* Fixed light-mode colors throughout this whole xlsx surface (tab row and table
               * alike), not the app's theme tokens (text-foreground, border-border, ...) — this
               * is meant to look like a document page, always white with dark text/borders
               * regardless of app theme, same as PDF/docx's own preview staying put in dark
               * mode. In dark mode text-foreground/text-muted-foreground/border-border resolve
               * to near-white (packages/ui/src/styles/globals.css's .dark block), which is why
               * this was rendering invisible — those tokens are meant for a dark background,
               * and this container is forced bg-white above. */}
              {xlsxSheets && xlsxSheets.length > 1 && (
                <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-neutral-200 bg-white px-2 pt-2">
                  {xlsxSheets.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveSheetIndex(i)}
                      className={`shrink-0 rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        i === activeSheetIndex
                          ? "bg-neutral-200 text-neutral-900"
                          : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                      }`}
                    >
                      {t("attachment.sheetLabel", { number: i + 1 })}
                    </button>
                  ))}
                </div>
              )}
              {/* Each sheet is a self-contained HTML table built from the workbook's own cells —
               * same trust level as any other document content this app already renders (an
               * org's own uploaded document, not arbitrary strangers' input). Deliberately NOT
               * stretched to fill the container — a short sheet is a short table, same as a
               * short PDF page isn't padded out with blank space. text-black because a cell only
               * gets an inline color when the workbook's own font formatting sets one (see
               * xlsx-preview's genCell.ts) — a plain, unformatted cell has no color style at all
               * and otherwise inherits whatever this app's own (possibly dark-mode) text color
               * is, rendering invisible against the forced-white background below. */}
              <div className="min-h-0 flex-1 overflow-auto bg-white p-4 text-black sm:p-8">
                <div dangerouslySetInnerHTML={{ __html: xlsxSheets?.[activeSheetIndex] ?? "" }} />
              </div>
            </>
          )}
        </div>
      ) : canDocTextPreview ? (
        <div className="h-full overflow-y-auto bg-white p-4 sm:p-8">
          {docLoading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t("attachment.loadingPreview")}
            </div>
          ) : (
            // No rich layout to reconstruct — word-extractor only gives back a flat body string
            // (see DocumentSvc.getTextPreview on the backend), so this is a plain text dump
            // rather than docx-preview's paginated rendering. whitespace-pre-wrap keeps the
            // extractor's own line breaks instead of collapsing them like normal HTML text flow.
            <p className="mx-auto max-w-3xl whitespace-pre-wrap text-sm text-neutral-900">{docText}</p>
          )}
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <FileText className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {t(
              isPdf || isImage || isDocx || isXlsx || isLegacyDoc
                ? "attachment.previewFailed"
                : "attachment.previewUnavailable",
            )}
          </p>
          {attachment.url &&
            (isPdf || isImage ? (
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-navy-950 hover:underline dark:text-white"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                {t("attachment.openInNewTab")}
              </a>
            ) : (
              <a
                href={attachment.url}
                download={attachment.name}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-navy-950 hover:underline dark:text-white"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {t("attachment.download")}
              </a>
            ))}
        </div>
      )}
    </div>
  );
}
