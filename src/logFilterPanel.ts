import * as vscode from "vscode";
import { LogLevelFilter } from "./logLevel";

const LEVELS: LogLevelFilter[] = [
  "ALL",
  "DEBUG",
  "INFO",
  "WARNING",
  "ERROR",
];

export class LogFilterPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "logFilter.controls";

  private webviewView: vscode.WebviewView | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onPickLevel: (level: LogLevelFilter) => void,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
    };
    const lastLevel = this.context.workspaceState.get<LogLevelFilter>(
      "logFilter.lastLevel",
      "ALL",
    );
    webviewView.webview.html = this.getHtml(lastLevel);
    webviewView.webview.onDidReceiveMessage((message: { type?: string; level?: string }) => {
      if (message.type !== "setLevel" || !message.level) {
        return;
      }
      const level = message.level as LogLevelFilter;
      if (!LEVELS.includes(level)) {
        return;
      }
      void this.context.workspaceState.update("logFilter.lastLevel", level);
      this.onPickLevel(level);
    });
  }

  refreshHighlight(selected: LogLevelFilter): void {
    if (!this.webviewView) {
      return;
    }
    void this.webviewView.webview.postMessage({
      type: "highlight",
      level: selected,
    });
  }

  private getHtml(selected: LogLevelFilter): string {
    const buttons = LEVELS.map(
      (level) =>
        `<button type="button" class="lvl ${level === selected ? "active" : ""}" data-level="${level}">${level}</button>`,
    ).join("");
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: var(--vscode-font-family); font-size: 12px; padding: 8px; margin: 0; }
    p { margin: 0 0 8px; color: var(--vscode-descriptionForeground); }
    .row { display: flex; flex-wrap: wrap; gap: 6px; }
    button {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-widget-border, transparent);
      padding: 4px 8px;
      border-radius: 3px;
      cursor: pointer;
    }
    button:hover { background: var(--vscode-button-secondaryHoverBackground); }
    button.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
  </style>
</head>
<body>
  <p>Filter lines in the active <code>.log</code> file. Opens a preview tab.</p>
  <div class="row">${buttons}</div>
  <script>
    const vscode = acquireVsCodeApi();
    function setActive(level) {
      document.querySelectorAll('button.lvl').forEach(function (b) {
        b.classList.toggle('active', b.dataset.level === level);
      });
    }
    document.querySelectorAll('button.lvl').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var level = btn.dataset.level;
        setActive(level);
        vscode.postMessage({ type: 'setLevel', level: level });
      });
    });
    window.addEventListener('message', function (event) {
      var m = event.data;
      if (m && m.type === 'highlight' && m.level) setActive(m.level);
    });
  </script>
</body>
</html>`;
  }
}
