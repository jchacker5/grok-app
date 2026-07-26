/**
 * "What's new in vX.Y.Z" panel — shown once per app version (first boot
 * after an update) and reopenable from Settings → About.
 *
 * Reuses the shared `GlassModal` chrome (same as DoctorModal/CommitDialog)
 * and `MarkdownBody` (same GFM renderer already used for chat messages) so
 * this doesn't pull in a second markdown dependency. Long entries scroll via
 * `OverlayScroll` (native scrollbars are hidden app-wide — a raw
 * `overflow-y: auto` here would silently clip content with no visible
 * scroll affordance).
 */

import { GlassModal } from "@/components/GlassModal";
import { MarkdownBody } from "@/components/MarkdownBody";
import { OverlayScroll } from "@/components/OverlayScroll";
import type { Locale } from "@/i18n";
import { createT } from "@/i18n";

export interface WhatsNewModalProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  /** e.g. "0.1.13" — rendered as "What's new in v0.1.13". */
  version: string;
  /** Changelog section body markdown (already sliced to just this version). */
  body: string;
  date?: string | null;
}

export function WhatsNewModal({
  open,
  onClose,
  locale,
  version,
  body,
  date,
}: WhatsNewModalProps) {
  const tr = createT(locale);

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={tr("whatsNew.title", { v: version })}
      size="lg"
      closeLabel={tr("whatsNew.close")}
      wrapBody
      bodyClassName="whats-new-modal__body"
      footer={
        <button type="button" className="btn btn--solid" onClick={onClose}>
          {tr("whatsNew.close")}
        </button>
      }
    >
      {date ? <p className="whats-new-modal__date">{date}</p> : null}
      <OverlayScroll className="whats-new-modal__scroll">
        <MarkdownBody locale={locale}>{body}</MarkdownBody>
      </OverlayScroll>
    </GlassModal>
  );
}
