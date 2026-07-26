/**
 * Quota usage threshold-crossing dedup logic (pure, unit-testable).
 *
 * Fixed thresholds in v1 (not user-configurable): 80% / 95% of the billing
 * period's usage. `resolveThresholdCrossed` decides whether a *new* threshold
 * has been crossed since the last alert so a long-running session doesn't
 * re-notify on every poll; `load`/`saveQuotaAlertState` persist the
 * highest-alerted threshold per billing period to `localStorage` (or any
 * `Storage`-typed object, for testability — same pattern as `theme.ts` /
 * `accountUi.ts`).
 */

/** Fixed v1 alert thresholds, percent of quota used. */
export const QUOTA_ALERT_THRESHOLDS: readonly number[] = [80, 95];

/** `localStorage` key for the persisted dedup state. */
export const QUOTA_ALERT_STORAGE_KEY = "grok-app.quotaAlert";

export interface QuotaAlertState {
  /** Identifier for the current billing period (e.g. `billingPeriodStart` or `resetsAt`). */
  periodKey: string;
  /** Highest threshold (from `QUOTA_ALERT_THRESHOLDS`) already alerted on this period. */
  highestAlerted: number;
}

/**
 * Returns the highest threshold in `thresholds` that `usedPercent` has now
 * crossed but `highestAlerted` had not yet reached, or `null` when nothing
 * new has been crossed. `highestAlerted` of `null` means no prior alert this
 * period (equivalent to a baseline of 0).
 */
export function resolveThresholdCrossed(
  usedPercent: number,
  thresholds: number[],
  highestAlerted: number | null,
): number | null {
  const baseline = highestAlerted ?? 0;
  let crossed: number | null = null;
  for (const threshold of thresholds) {
    if (usedPercent >= threshold && threshold > baseline) {
      if (crossed === null || threshold > crossed) {
        crossed = threshold;
      }
    }
  }
  return crossed;
}

/** Read persisted alert state from a storage-like object. Never throws. */
export function loadQuotaAlertState(storage: Storage): QuotaAlertState | null {
  try {
    const raw = storage.getItem(QUOTA_ALERT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<QuotaAlertState> | null;
    if (
      parsed &&
      typeof parsed.periodKey === "string" &&
      typeof parsed.highestAlerted === "number" &&
      Number.isFinite(parsed.highestAlerted)
    ) {
      return { periodKey: parsed.periodKey, highestAlerted: parsed.highestAlerted };
    }
    return null;
  } catch {
    return null;
  }
}

/** Persist alert state for the given billing period. Never throws. */
export function saveQuotaAlertState(
  storage: Storage,
  periodKey: string,
  highestAlerted: number,
): void {
  try {
    const state: QuotaAlertState = { periodKey, highestAlerted };
    storage.setItem(QUOTA_ALERT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Resolve the highest-alerted baseline to use for `resolveThresholdCrossed`
 * given previously stored state and the current period's key. When the
 * stored period doesn't match, the baseline resets to `null` (new billing
 * period — allow re-alerting from scratch) with no separate branch needed
 * elsewhere in the caller.
 */
export function baselineForPeriod(
  stored: QuotaAlertState | null,
  periodKey: string,
): number | null {
  if (!stored || stored.periodKey !== periodKey) return null;
  return stored.highestAlerted;
}
