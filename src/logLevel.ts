export type LogLevelFilter = "ALL" | "DEBUG" | "INFO" | "WARNING" | "ERROR";

const LEVEL_PATTERNS: Array<{
  filter: Exclude<LogLevelFilter, "ALL">;
  pattern: RegExp;
}> = [
  { filter: "DEBUG", pattern: /\bDEBUG\b/i },
  { filter: "INFO", pattern: /\bINFO\b/i },
  { filter: "WARNING", pattern: /\b(?:WARNING|WARN)\b/i },
  { filter: "ERROR", pattern: /\b(?:ERROR|ERR|CRITICAL|FATAL)\b/i },
];

export function detectLevelInLine(line: string): Exclude<LogLevelFilter, "ALL"> | null {
  for (const { filter, pattern } of LEVEL_PATTERNS) {
    if (pattern.test(line)) {
      return filter;
    }
  }
  return null;
}

export function filterLinesByLevel(
  text: string,
  level: LogLevelFilter,
  contextLines = 0,
): string {
  if (level === "ALL") {
    return text;
  }
  const lines = text.split(/\r?\n/);
  const normalizedContext = Math.max(0, Math.floor(contextLines));
  const ranges: Array<{ start: number; end: number }> = [];

  lines.forEach((line, index) => {
    if (detectLevelInLine(line) !== level) {
      return;
    }
    const start = Math.max(0, index - normalizedContext);
    const end = Math.min(lines.length - 1, index + normalizedContext);
    const previous = ranges[ranges.length - 1];
    if (previous && start <= previous.end + 1) {
      previous.end = Math.max(previous.end, end);
      return;
    }
    ranges.push({ start, end });
  });

  return ranges
    .flatMap((range) => lines.slice(range.start, range.end + 1))
    .join("\n");
}

export function parseLevelFromQuery(query: string): LogLevelFilter {
  const params = new URLSearchParams(query);
  const raw = params.get("level")?.toUpperCase();
  if (
    raw === "DEBUG" ||
    raw === "INFO" ||
    raw === "WARNING" ||
    raw === "ERROR" ||
    raw === "ALL"
  ) {
    return raw;
  }
  return "ALL";
}

export function parseContextLinesFromQuery(query: string): number {
  const params = new URLSearchParams(query);
  const raw = Number.parseInt(params.get("context") ?? "0", 10);
  if (Number.isNaN(raw) || raw < 0) {
    return 0;
  }
  return raw;
}
