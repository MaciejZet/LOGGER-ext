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
    private readonly onChangeFilter: (
      level: LogLevelFilter,
      contextLines: number,
    ) => void,
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
    const contextLines = this.context.workspaceState.get<number>(
      "logFilter.contextLines",
      0,
    );
    webviewView.webview.html = this.getHtml(lastLevel, contextLines);
    webviewView.webview.onDidReceiveMessage((message: {
      type?: string;
      level?: string;
      contextLines?: number;
    }) => {
      if (message.type !== "setFilter" || !message.level) {
        return;
      }
      const level = message.level as LogLevelFilter;
      if (!LEVELS.includes(level)) {
        return;
      }
      const nextContext = Number.isFinite(message.contextLines)
        ? Math.max(0, Math.floor(message.contextLines ?? 0))
        : 0;
      void this.context.workspaceState.update("logFilter.lastLevel", level);
      void this.context.workspaceState.update(
        "logFilter.contextLines",
        nextContext,
      );
      this.onChangeFilter(level, nextContext);
    });
  }

  refreshState(selected: LogLevelFilter, contextLines: number): void {
    if (!this.webviewView) {
      return;
    }
    void this.webviewView.webview.postMessage({
      type: "syncState",
      level: selected,
      contextLines,
    });
  }

  private getHtml(selected: LogLevelFilter, contextLines: number): string {
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
    .context { margin-top: 10px; display: grid; gap: 6px; }
    label { color: var(--vscode-descriptionForeground); }
    input[type="number"] {
      width: 100%;
      box-sizing: border-box;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--vscode-widget-border, transparent));
      padding: 5px 6px;
      border-radius: 3px;
    }
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
  <div class="context">
    <label for="contextLines">Context lines before and after each match</label>
    <input id="contextLines" type="number" min="0" step="1" value="${contextLines}" />
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const contextInput = document.getElementById('contextLines');
    function getContextLines() {
      var parsed = parseInt(contextInput.value || '0', 10);
      if (Number.isNaN(parsed) || parsed < 0) return 0;
      return parsed;
    }
    function setActive(level) {
      document.querySelectorAll('button.lvl').forEach(function (b) {
        b.classList.toggle('active', b.dataset.level === level);
      });
    }
    function syncState(level, contextLines) {
      setActive(level);
      contextInput.value = String(contextLines);
    }
    function submit(level) {
      vscode.postMessage({
        type: 'setFilter',
        level: level,
        contextLines: getContextLines(),
      });
    }
    document.querySelectorAll('button.lvl').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var level = btn.dataset.level;
        setActive(level);
        submit(level);
      });
    });
    contextInput.addEventListener('change', function () {
      var active = document.querySelector('button.lvl.active');
      if (!active) return;
      submit(active.dataset.level);
    });
    window.addEventListener('message', function (event) {
      var m = event.data;
      if (m && m.type === 'syncState' && m.level) syncState(m.level, m.contextLines || 0);
    });
  </script>
</body>
</html>`;
  }
}
