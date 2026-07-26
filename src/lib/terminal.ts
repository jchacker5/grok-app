let terminalSequence = 0;

export function generateTerminalId(): string {
  terminalSequence += 1;
  return `terminal_${Date.now()}_${terminalSequence.toString(36)}`;
}

export function trimScrollbackLines(
  lines: string[],
  maxLines: number,
): string[] {
  if (maxLines <= 0) return [];
  return lines.slice(-maxLines);
}
