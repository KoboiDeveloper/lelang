const STORAGE_KEY = "elang_push_state_v2";

/** Setelah "Nanti saja", jangan auto-prompt lagi selama periode ini. */
export const PUSH_DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

type PushPromptState = {
  subscribed: boolean;
  /** epoch ms saat user dismiss auto-prompt */
  dismissedAt?: number | null;
};

function readState(): PushPromptState {
  if (typeof window === "undefined") {
    return { subscribed: false, dismissedAt: null };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { subscribed: false, dismissedAt: null };
    const parsed = JSON.parse(raw) as Partial<PushPromptState>;
    return {
      subscribed: Boolean(parsed.subscribed),
      dismissedAt:
        typeof parsed.dismissedAt === "number" && Number.isFinite(parsed.dismissedAt)
          ? parsed.dismissedAt
          : null,
    };
  } catch {
    return { subscribed: false, dismissedAt: null };
  }
}

function writeState(state: PushPromptState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function notifyPushStateChange() {
  window.dispatchEvent(new CustomEvent("elang-push-state-change"));
}

export function isPushSubscribed() {
  return readState().subscribed;
}

export function markPushSubscribed() {
  writeState({ subscribed: true, dismissedAt: null });
  notifyPushStateChange();
}

export function clearPushSubscribed() {
  const prev = readState();
  writeState({ subscribed: false, dismissedAt: prev.dismissedAt ?? null });
  notifyPushStateChange();
}

export function markPushPromptDismissed() {
  const prev = readState();
  writeState({
    subscribed: prev.subscribed,
    dismissedAt: Date.now(),
  });
  notifyPushStateChange();
}

export function isPushPromptDismissedRecently(
  cooldownMs: number = PUSH_DISMISS_COOLDOWN_MS
) {
  const { dismissedAt } = readState();
  if (!dismissedAt) return false;
  return Date.now() - dismissedAt < cooldownMs;
}

/** Auto modal/banner hanya jika belum subscribe dan belum dismiss baru-baru ini. */
export function shouldAutoPromptPush() {
  if (isPushSubscribed()) return false;
  if (isPushPromptDismissedRecently()) return false;
  return true;
}
