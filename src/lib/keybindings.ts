export interface KeybindingDef {
  id: string;
  labelKey: string;
  defaultMac: string;
  defaultWin: string;
}

export const DEFAULT_KEYBINDINGS: KeybindingDef[] = [
  { id: "search", labelKey: "shortcuts.search", defaultMac: "⌘ K", defaultWin: "Ctrl K" },
  { id: "newChat", labelKey: "shortcuts.newChat", defaultMac: "⌘ N", defaultWin: "Ctrl N" },
  { id: "settings", labelKey: "shortcuts.settings", defaultMac: "⌘ ,", defaultWin: "Ctrl ," },
  { id: "doctor", labelKey: "shortcuts.doctor", defaultMac: "⌘ ⇧ D", defaultWin: "Ctrl Shift D" },
  { id: "stop", labelKey: "shortcuts.stop", defaultMac: "Esc", defaultWin: "Esc" },
  { id: "send", labelKey: "shortcuts.send", defaultMac: "⌘ ↵", defaultWin: "Ctrl Enter" },
  { id: "help", labelKey: "shortcuts.help", defaultMac: "⌘ /", defaultWin: "Ctrl /" },
  { id: "spaceSwitch", labelKey: "shortcuts.spaceSwitch", defaultMac: "⌘ ⌥ 1-9", defaultWin: "Ctrl Alt 1-9" },
  { id: "reopenClosed", labelKey: "shortcuts.reopenClosed", defaultMac: "⌘ ⇧ T", defaultWin: "Ctrl Shift T" },
  { id: "fileFinder", labelKey: "shortcuts.fileFinder", defaultMac: "⌘ P", defaultWin: "Ctrl P" },
];

export interface UserKeybindingOverrides {
  [id: string]: { mac?: string; win?: string } | undefined;
}

const STORAGE_KEY = "grok-keybindings";

export function getUserOverrides(): UserKeybindingOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function setUserOverrides(overrides: UserKeybindingOverrides): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function resolveKeybindings(platform: "mac" | "win" | "other"): Array<{ id: string; labelKey: string; keys: string }> {
  const overrides = getUserOverrides();
  return DEFAULT_KEYBINDINGS.map((kb) => ({
    id: kb.id,
    labelKey: kb.labelKey,
    keys: platform === "mac"
      ? overrides[kb.id]?.mac ?? kb.defaultMac
      : overrides[kb.id]?.win ?? kb.defaultWin,
  }));
}
