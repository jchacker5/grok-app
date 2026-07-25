/**
 * Session presets — reusable model / effort / mode / permission bundles
 * (Plan 005). Lives in the composer toolbar next to the model/access chips.
 * Presets are config-only: no message history, no autoload on startup.
 */

import { useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { SessionPresetDto } from "@/lib/api";
import { Tip } from "@/components/ui/tooltip";
import {
  IconCheck,
  IconLayoutGrid,
  IconPlus,
  IconRename,
  IconTrash,
} from "@/components/icons";
import { useFloatingMenu } from "@/lib/floatingMenu";

export interface PresetSelectorCurrent {
  modelId: string;
  effort: string;
  mode: string;
  permissionPolicy: string;
}

export interface PresetSelectorLabels {
  trigger: string;
  hint: string;
  empty: string;
  saveCurrent: string;
  rename: string;
  delete: string;
}

export interface PresetSelectorProps {
  presets: SessionPresetDto[];
  current: PresetSelectorCurrent;
  labels: PresetSelectorLabels;
  onApply: (preset: SessionPresetDto) => void;
  onSaveCurrent: () => void;
  onRename: (preset: SessionPresetDto) => void;
  onDelete: (preset: SessionPresetDto) => void;
}

function matchesCurrent(
  p: SessionPresetDto,
  current: PresetSelectorCurrent,
): boolean {
  return (
    p.modelId === current.modelId &&
    p.effort === current.effort &&
    p.mode === current.mode &&
    p.permissionPolicy === current.permissionPolicy
  );
}

export function PresetSelector({
  presets,
  current,
  labels,
  onApply,
  onSaveCurrent,
  onRename,
  onDelete,
}: PresetSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const popId = useId();

  const { pos, style } = useFloatingMenu({
    open,
    triggerRef,
    panelRef: popRef,
    roots: [rootRef],
    onClose: () => setOpen(false),
    placement: "auto",
    fitContent: true,
    minWidth: 240,
    estHeight: 260,
    gap: 8,
    deps: [presets.length],
  });

  const panel =
    open && pos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popRef}
            className="cmm__pop cmm__pop--portal"
            id={popId}
            role="dialog"
            aria-label={labels.trigger}
            style={style as CSSProperties | undefined}
          >
            <div className="cmm__header">
              <div className="cmm__header-title">{labels.hint}</div>
            </div>
            {presets.length === 0 ? (
              <div className="cmm__opt cmm__opt--muted" role="status">
                <span className="cmm__opt-main">
                  <span className="cmm__opt-title">{labels.empty}</span>
                </span>
              </div>
            ) : (
              presets.map((p) => {
                const active = matchesCurrent(p, current);
                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    className={"cmm__opt cmm__opt--rich" + (active ? " is-active" : "")}
                    onClick={() => {
                      onApply(p);
                      setOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onApply(p);
                        setOpen(false);
                      }
                    }}
                  >
                    <span className="cmm__opt-main">
                      <span className="cmm__opt-title">{p.name}</span>
                      {p.description ? (
                        <span className="cmm__opt-desc">{p.description}</span>
                      ) : null}
                    </span>
                    {active ? (
                      <span className="cmm__opt-check" aria-hidden>
                        <IconCheck size={16} />
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="cmm__opt-icon"
                      aria-label={labels.rename}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRename(p);
                      }}
                    >
                      <IconRename size={14} />
                    </button>
                    <button
                      type="button"
                      className="cmm__opt-icon"
                      aria-label={labels.delete}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(p);
                      }}
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                );
              })
            )}
            <div className="cmm__section cmm__section--gap" />
            <button
              type="button"
              className="cmm__opt cmm__opt--rich"
              onClick={() => {
                setOpen(false);
                onSaveCurrent();
              }}
            >
              <span className="cmm__opt-icon" aria-hidden>
                <IconPlus size={16} />
              </span>
              <span className="cmm__opt-main">
                <span className="cmm__opt-title">{labels.saveCurrent}</span>
              </span>
            </button>
          </div>,
          document.body,
        )
      : null;

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      className="cmm__trigger"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={popId}
      aria-label={labels.trigger}
      onClick={() => setOpen((v) => !v)}
    >
      <span className="cmm__icon" aria-hidden>
        <IconLayoutGrid size={14} />
      </span>
      <span className="cmm__trigger-text cmm__trigger-text--full">
        {labels.trigger}
      </span>
    </button>
  );

  return (
    <div ref={rootRef} className={"cmm cmm--presets" + (open ? " is-open" : "")}>
      <Tip label={labels.trigger}>{trigger}</Tip>
      {panel}
    </div>
  );
}
