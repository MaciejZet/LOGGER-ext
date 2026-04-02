export type LogLevelFilter = "ALL" | "DEBUG" | "INFO" | "WARNING" | "ERROR";

const LEVEL_PATTERN = /\b(DEBUG|INFO|WARNING|ERROR)\b/i;

export function detectLevelInLine(line: string): Exclude<LogLevelFilter, "ALL"> | null {
  const match = line.match(LEVEL_PATTERN);
  if (!match?.[1]) {
    return null;
  }
  return match[1].toUpperCase() as Exclude<LogLevelFilter, "ALL">;
}

export function filterLinesByLevel(
  text: string,
  level: LogLevelFilter,
): string {
  if (level === "ALL") {
    return text;
  }
  const lines = text.split(/\r?\n/);
  const kept = lines.filter((line) => detectLevelInLine(line) === level);
  return kept.join("\n");
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
