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

function isLogDocument(uri: vscode.Uri): boolean {
  if (uri.scheme === LOG_FILTER_SCHEME) {
    return false;
  }
  const path = uri.fsPath || uri.path;
  return path.toLowerCase().endsWith(".log");
}

function getActiveLogUri(): vscode.Uri | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }
  const doc = editor.document;
  if (isLogDocument(doc.uri)) {
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
  const panelCallback = async (level: LogLevelFilter): Promise<void> => {
    const logUri = getActiveLogUri();
    if (!logUri) {
      void vscode.window.showWarningMessage(
        "Log Filter: open a .log file in the editor first.",
      );
      return;
    }
    await openFilteredPreview(context, provider, logUri, level);
    panelProvider.refreshHighlight(level);
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
      await openFilteredPreview(context, provider, logUri, level);
    },
  );
  context.subscriptions.push(openCommand);

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (isLogDocument(doc.uri)) {
        refreshVirtualDocsForSource(provider, doc.uri);
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (!isLogDocument(event.document.uri)) {
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
      if (!editor || !isLogDocument(editor.document.uri)) {
        return;
      }
      const level =
        context.workspaceState.get<LogLevelFilter>(LAST_LEVEL_KEY, "ALL") ??
        "ALL";
      panelProvider.refreshHighlight(level);
    }),
  );
}

async function openFilteredPreview(
  context: vscode.ExtensionContext,
  provider: LogFilterContentProvider,
  fileUri: vscode.Uri,
  level: LogLevelFilter,
): Promise<void> {
  await context.workspaceState.update(LAST_LEVEL_KEY, level);
  const virtualUri = buildVirtualUri(fileUri, level);
  const doc = await vscode.workspace.openTextDocument(virtualUri);
  await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: true });
}

export function deactivate(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
}
