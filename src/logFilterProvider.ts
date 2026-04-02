import * as vscode from "vscode";
import {
  parseContextLinesFromQuery,
  filterLinesByLevel,
  LogLevelFilter,
  parseLevelFromQuery,
} from "./logLevel";

export const LOG_FILTER_SCHEME = "log-filter";

export function buildVirtualUri(
  fileUri: vscode.Uri,
  level: LogLevelFilter,
  contextLines: number,
): vscode.Uri {
  const params = new URLSearchParams();
  params.set("level", level);
  params.set("context", String(Math.max(0, Math.floor(contextLines))));
  params.set("ref", fileUri.toString(true));
  return fileUri.with({
    scheme: LOG_FILTER_SCHEME,
    query: params.toString(),
  });
}

export function sourceUriFromVirtual(uri: vscode.Uri): vscode.Uri | null {
  if (uri.scheme !== LOG_FILTER_SCHEME) {
    return null;
  }
  const params = new URLSearchParams(uri.query);
  const ref = params.get("ref");
  if (ref) {
    try {
      return vscode.Uri.parse(ref);
    } catch {
      return null;
    }
  }
  return uri.with({ scheme: "file", query: "", fragment: "" });
}

export class LogFilterContentProvider implements vscode.TextDocumentContentProvider {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

  readonly onDidChange = this.onDidChangeEmitter.event;

  fireDocumentChange(uri: vscode.Uri): void {
    this.onDidChangeEmitter.fire(uri);
  }

  dispose(): void {
    this.onDidChangeEmitter.dispose();
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const source = sourceUriFromVirtual(uri);
    if (!source) {
      return "";
    }
    const level = parseLevelFromQuery(uri.query);
    const contextLines = parseContextLinesFromQuery(uri.query);
    const bytes = await vscode.workspace.fs.readFile(source);
    const text = new TextDecoder("utf-8").decode(bytes);
    return filterLinesByLevel(text, level, contextLines);
  }
}
