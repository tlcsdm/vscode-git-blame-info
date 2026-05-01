---
name: vscode-webview-and-ui
description: Guidance for building VS Code webviews and native extension UI while preserving accessibility, security, and theme compatibility.
---

# Skill: Webviews and Native VS Code UI

## Overview

VS Code provides both native UI components (QuickPick, InputBox, TreeView, StatusBar, etc.)
and the **Webview API** for fully custom HTML/CSS/JS panels. Always prefer native UI when it
fits — it stays consistent with VS Code themes and accessibility standards. Use Webviews for
complex interactive UIs that cannot be expressed with native components.

---

## Native UI Components

### Messages and Notifications

```typescript
// Information / Warning / Error messages
await vscode.window.showInformationMessage('Operation complete.');
const action = await vscode.window.showWarningMessage('Overwrite file?', 'Yes', 'Cancel');
vscode.window.showErrorMessage(`Failed: ${error.message}`);
```

### QuickPick

```typescript
// Simple string pick
const choice = await vscode.window.showQuickPick(['Option A', 'Option B'], {
    placeHolder: 'Select an option',
    canPickMany: false,
});

// Structured items
const items: vscode.QuickPickItem[] = [
    { label: '$(symbol-class) MyClass', description: 'src/MyClass.ts', detail: 'A class' },
];
const selected = await vscode.window.showQuickPick(items, { matchOnDescription: true });
```

### InputBox

```typescript
const value = await vscode.window.showInputBox({
    prompt: 'Enter Scene Builder path',
    placeHolder: '/Applications/SceneBuilder.app',
    validateInput: (v) => v.trim() ? undefined : 'Path cannot be empty',
});
```

### Progress Notification

```typescript
await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Indexing…', cancellable: true },
    async (progress, token) => {
        for (let i = 0; i < steps.length; i++) {
            if (token.isCancellationRequested) { break; }
            progress.report({ message: steps[i], increment: (100 / steps.length) });
            await processStep(steps[i]);
        }
    }
);
```

### Status Bar

```typescript
const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
item.text = '$(symbol-class) FXML';
item.tooltip = 'JavaFX Support active';
item.command = 'ext.myCommand';
item.show();
context.subscriptions.push(item);
```

### TreeView / TreeDataProvider

```typescript
export class MyTreeProvider implements vscode.TreeDataProvider<MyNode> {
    private _onDidChangeTreeData = new vscode.EventEmitter<MyNode | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void { this._onDidChangeTreeData.fire(); }

    getTreeItem(element: MyNode): vscode.TreeItem {
        const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
        item.iconPath = new vscode.ThemeIcon('symbol-class');
        item.command = { command: 'ext.openNode', title: 'Open', arguments: [element] };
        return item;
    }

    getChildren(element?: MyNode): vscode.ProviderResult<MyNode[]> {
        return element ? element.children : this.roots;
    }
}

const provider = new MyTreeProvider();
context.subscriptions.push(
    vscode.window.createTreeView('myView', { treeDataProvider: provider, showCollapseAll: true })
);
```

Register the view in `package.json`:

```jsonc
"contributes": {
  "views": {
    "explorer": [
      { "id": "myView", "name": "My View", "when": "ext.myFeatureEnabled" }
    ]
  }
}
```

---

## Webview API

Use Webviews for rich custom panels (e.g., visual editors, dashboards, preview panes).

### Creating a Webview Panel

```typescript
const panel = vscode.window.createWebviewPanel(
    'myPanel',                          // viewType (unique identifier)
    'My Panel',                         // title
    vscode.ViewColumn.Beside,           // editor column
    {
        enableScripts: true,            // allow JavaScript in the webview
        localResourceRoots: [           // restrict file access to these URIs
            vscode.Uri.joinPath(context.extensionUri, 'media'),
        ],
        retainContextWhenHidden: false, // true = keep alive when tab is hidden (memory cost)
    }
);
context.subscriptions.push(panel);
panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);
```

### Generating Safe HTML

```typescript
function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.css'));
    const nonce = getNonce(); // random string for CSP

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <link rel="stylesheet" href="${styleUri}">
</head>
<body>
    <div id="app"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
```

### Messaging: Extension ↔ Webview

```typescript
// Extension → Webview
panel.webview.postMessage({ command: 'update', data: payload });

// Webview → Extension
panel.webview.onDidReceiveMessage((message) => {
    switch (message.command) {
        case 'save': saveData(message.data); break;
        case 'alert': vscode.window.showErrorMessage(message.text); break;
    }
});

// In webview JavaScript (media/main.js):
const vscode = acquireVsCodeApi();
vscode.postMessage({ command: 'save', data: formData });
window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.command === 'update') { renderUpdate(msg.data); }
});
```

---

## Custom Editor API

For file-format-specific visual editors (e.g., a visual FXML layout editor):

```typescript
export class FxmlEditorProvider implements vscode.CustomTextEditorProvider {
    static register(context: vscode.ExtensionContext): vscode.Disposable {
        return vscode.window.registerCustomEditorProvider('ext.fxmlEditor', new FxmlEditorProvider(context));
    }

    async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = { enableScripts: true };
        webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

        // Sync document changes → webview
        const changeSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.uri.toString() === document.uri.toString()) {
                webviewPanel.webview.postMessage({ type: 'update', text: document.getText() });
            }
        });
        webviewPanel.onDidDispose(() => changeSubscription.dispose());
    }
}
```

Register in `package.json`:

```jsonc
"customEditors": [
  {
    "viewType": "ext.fxmlEditor",
    "displayName": "FXML Visual Editor",
    "selector": [{ "filenamePattern": "*.fxml" }],
    "priority": "option"
  }
]
```

---

## Security Checklist for Webviews

- [ ] Always set a strict `Content-Security-Policy` with a `nonce`.
- [ ] Never interpolate untrusted data directly into HTML strings (use `textContent` in JS, not `innerHTML`).
- [ ] Keep `localResourceRoots` as narrow as possible.
- [ ] Do not enable `enableScripts` unless the webview actually needs scripts.
- [ ] Validate every message received from the webview before acting on it.

---

## References

- [Webview API Guide](https://code.visualstudio.com/api/extension-guides/webview)
- [Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors)
- [TreeView API](https://code.visualstudio.com/api/extension-guides/tree-view)
- [VS Code UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/overview)
