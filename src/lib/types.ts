/**
 * Shared app domain types.
 */

export interface GoalConfig {
  goal: string;
  subgoals: string[];
  context: string;
  completedSubgoals: number[];
}

export interface CallLogEntry {
  id: string;
  timestamp?: number;
  model?: string;
  tokens_prompt?: number;
  tokens_completion?: number;
  cost_usd?: number;
  duration_ms?: number;
  status?: string;

  // Legacy/UI fields
  title?: string;
  projectPath?: string;
  turns?: number;
  contextTokens?: number;
  durationSecs?: number;
  startedAt?: string;
}

export interface SessionPreset {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  model: string;
  effort: 'low' | 'medium' | 'high';
  yolo: boolean;
  temperature: number;
  createdAt: number;
}

export interface LibraryPrompt {
  id: string;
  name: string;
  description: string;
  content: string;
  category: 'general' | 'coding' | 'writing' | 'analysis' | 'custom';
  isBuiltIn?: boolean;
}

export interface CustomCommand {
  id: string;
  name: string;
  description: string;
  actionType: 'insert_text' | 'run_shell';
  actionValue: string;
  shortcut?: string;
}

export interface NotificationSettings {
  desktopEnabled: boolean;
  soundEnabled: boolean;
  inAppBadge: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  notifyOnCompletion: boolean;
  notifyOnError: boolean;
}

export interface DepNode {
  id: string;
  label: string;
  version: string;
  installed: boolean;
}

export interface DepEdge {
  from: string;
  to: string;
  relation: string;
}

export interface DepGraph {
  nodes: DepNode[];
  edges: DepEdge[];
}

export interface SyncStatus {
  method: string;
  path: string;
  lastSynced?: number;
  isActive: boolean;
}
