import * as vscode from "vscode";
import {
  buildVirtualUri,
  LogFilterContentProvider,
  LOG_FILTER_SCHEME,
  sourceUriFromVirtual,
} from "./logFilterProvider";
import { LogLevelFilter } from "./logLevel";
import { LogFilterPanelProvider } from "./logFilterPanel";

const LAST_LEVEL_KEY = "logFilter.lastLevel";
const CONTEXT_LINES_KEY = "logFilter.contextLines";

function isLogPath(uri: vscode.Uri): boolean {
  if (uri.scheme === LOG_FILTER_SCHEME) {
    return false;
  }
  const p = uri.fsPath || uri.path;
  return p.toLowerCase().endsWith(".log");
}

/** True for real .log paths or any file the user set to language id "log". */
function isLogWorkspaceDocument(doc: vscode.TextDocument): boolean {
  if (doc.uri.scheme === LOG_FILTER_SCHEME) {
    return false;
  }
  return isLogPath(doc.uri) || doc.languageId === "log";
}

/**
 * URI of the file to read when filtering: either the active .log document, or the
 * backing file when the active tab is a log-filter preview.
 */
function getActiveLogUri(): vscode.Uri | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }
  const doc = editor.document;
  if (doc.uri.scheme === LOG_FILTER_SCHEME) {
    const source = sourceUriFromVirtual(doc.uri);
    if (!source) {
      return undefined;
    }
    return isLogPath(source) ? source : undefined;
  }
  if (isLogWorkspaceDocument(doc)) {
    return doc.uri;
  }
  return undefined;
}

function refreshVirtualDocsForSource(
  provider: LogFilterContentProvider,
  sourceUri: vscode.Uri,
): void {
  for (const doc of vscode.workspace.textDocuments) {
    if (doc.uri.scheme !== LOG_FILTER_SCHEME) {
      continue;
    }
    const src = sourceUriFromVirtual(doc.uri);
    if (src && src.toString() === sourceUri.toString()) {
      provider.fireDocumentChange(doc.uri);
    }
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const provider = new LogFilterContentProvider();

  let panelProvider: LogFilterPanelProvider;
  const panelCallback = async (
    level: LogLevelFilter,
    contextLines: number,
  ): Promise<void> => {
    const logUri = getActiveLogUri();
    if (!logUri) {
      void vscode.window.showWarningMessage(
        "Log Filter: open a .log file in the editor first.",
      );
      return;
    }
    await openFilteredPreview(context, provider, logUri, level, contextLines);
    panelProvider.refreshState(level, contextLines);
  };

  panelProvider = new LogFilterPanelProvider(context, panelCallback);

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      LOG_FILTER_SCHEME,
      provider,
    ),
    vscode.window.registerWebviewViewProvider(
      LogFilterPanelProvider.viewId,
      panelProvider,
    ),
    provider,
  );

  const openCommand = vscode.commands.registerCommand(
    "logFilter.openFiltered",
    async () => {
      const logUri = getActiveLogUri();
      if (!logUri) {
        void vscode.window.showInformationMessage(
          "Log Filter: active editor is not a .log file.",
        );
        return;
      }
      const level =
        context.workspaceState.get<LogLevelFilter>(LAST_LEVEL_KEY, "ALL") ??
        "ALL";
      const contextLines =
        context.workspaceState.get<number>(CONTEXT_LINES_KEY, 0) ?? 0;
      await openFilteredPreview(
        context,
        provider,
        logUri,
        level,
        contextLines,
      );
    },
  );
  context.subscriptions.push(openCommand);

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (isLogWorkspaceDocument(doc)) {
        refreshVirtualDocsForSource(provider, doc.uri);
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (!isLogWorkspaceDocument(event.document)) {
        return;
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        refreshVirtualDocsForSource(provider, event.document.uri);
      }, 500);
    }),
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!editor) {
        return;
      }
      const d = editor.document;
      const onLog =
        d.uri.scheme === LOG_FILTER_SCHEME
          ? (() => {
              const s = sourceUriFromVirtual(d.uri);
              return Boolean(s && isLogPath(s));
            })()
          : isLogWorkspaceDocument(d);
      if (!onLog) {
        return;
      }
      const level =
        context.workspaceState.get<LogLevelFilter>(LAST_LEVEL_KEY, "ALL") ??
        "ALL";
      const contextLines =
        context.workspaceState.get<number>(CONTEXT_LINES_KEY, 0) ?? 0;
      panelProvider.refreshState(level, contextLines);
    }),
  );
}

async function openFilteredPreview(
  context: vscode.ExtensionContext,
  provider: LogFilterContentProvider,
  fileUri: vscode.Uri,
  level: LogLevelFilter,
  contextLines: number,
): Promise<void> {
  await context.workspaceState.update(LAST_LEVEL_KEY, level);
  await context.workspaceState.update(
    CONTEXT_LINES_KEY,
    Math.max(0, Math.floor(contextLines)),
  );
  const virtualUri = buildVirtualUri(fileUri, level, contextLines);
  const doc = await vscode.workspace.openTextDocument(virtualUri);
  await vscode.window.showTextDocument(doc, {
    preview: true,
    preserveFocus: false,
  });
}

export function deactivate(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
}
