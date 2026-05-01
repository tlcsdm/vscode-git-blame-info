---
name: vscode-commands-and-activation
description: Guidance for implementing and modifying VS Code commands, menus, when clauses, and activation behavior.
---

# Skill: Commands and Extension Activation

## Overview

Commands are the primary action mechanism in VS Code. Understanding how to register, invoke,
and control the visibility of commands — and how activation events relate to them — is essential
for every extension.

---

## Registering Commands

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
    // Basic command
    context.subscriptions.push(
        vscode.commands.registerCommand('ext.myCommand', () => {
            vscode.window.showInformationMessage('Hello from myCommand!');
        })
    );

    // Command with URI argument (context menus pass a Uri)
    context.subscriptions.push(
        vscode.commands.registerCommand('ext.openFile', (uri?: vscode.Uri) => {
            const target = uri ?? vscode.window.activeTextEditor?.document.uri;
            if (!target) { return; }
            // ...
        })
    );

    // Text editor command (receives TextEditor + TextEditorEdit)
    context.subscriptions.push(
        vscode.commands.registerTextEditorCommand('ext.formatSelection', (editor, edit) => {
            edit.replace(editor.selection, transform(editor.document.getText(editor.selection)));
        })
    );
}
```

---

## Executing Commands Programmatically

```typescript
// Execute a built-in or contributed command
await vscode.commands.executeCommand('workbench.action.reloadWindow');

// Execute with arguments
await vscode.commands.executeCommand('vscode.open', vscode.Uri.file('/path/to/file'));

// Execute and capture return value
const items = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
    'vscode.executeDocumentSymbolProvider',
    document.uri
);
```

---

## Command Palette Visibility

To **hide** a command from the Command Palette (useful for internal/programmatic commands):

```jsonc
// package.json
"menus": {
  "commandPalette": [
    { "command": "ext.internalCommand", "when": "false" }
  ]
}
```

To show a command **only** in specific contexts:

```jsonc
"commandPalette": [
  { "command": "ext.fxmlCommand", "when": "resourceLangId == fxml" }
]
```

---

## Activation Events

### Best Practices

1. **`onLanguage:<id>`** — Activate when a file of a language is opened. Most common for language feature extensions.
2. **`onCommand:<id>`** — Activate when a specific command is about to run. Useful if the extension does not need to be active before the command is invoked.
3. **`workspaceContains:<glob>`** — Activate when the workspace contains matching files (e.g., `"workspaceContains:**/pom.xml"`).
4. **`onStartupFinished`** — Activate shortly after VS Code starts, without blocking startup. Use for lightweight background tasks.
5. **`*`** — Avoid; activates on every VS Code window open.

```jsonc
// package.json
"activationEvents": [
  "onLanguage:fxml",
  "onLanguage:java"
]
```

> **VS Code 1.74+**: `onCommand:` events for commands declared in `contributes.commands` are
> automatically inferred — you no longer need to list them explicitly.

---

## Context Keys and `when` Clauses

Set a custom context key to control command/menu visibility dynamically:

```typescript
// Set a context key
await vscode.commands.executeCommand('setContext', 'ext.myFeatureEnabled', true);
```

Use it in `package.json`:

```jsonc
"menus": {
  "editor/title": [
    {
      "command": "ext.myCommand",
      "when": "ext.myFeatureEnabled && resourceLangId == fxml"
    }
  ]
}
```

---

## Progress and Long-Running Commands

```typescript
await vscode.window.withProgress(
    {
        location: vscode.ProgressLocation.Notification,
        title: 'Processing…',
        cancellable: true,
    },
    async (progress, token) => {
        progress.report({ message: 'Step 1', increment: 30 });
        if (token.isCancellationRequested) { return; }
        await doExpensiveWork();
        progress.report({ message: 'Done', increment: 70 });
    }
);
```

---

## Input from Users

```typescript
// Quick pick
const choice = await vscode.window.showQuickPick(['Option A', 'Option B'], {
    placeHolder: 'Choose an option',
});

// Input box
const input = await vscode.window.showInputBox({
    prompt: 'Enter the Scene Builder path',
    validateInput: (value) => value ? undefined : 'Path cannot be empty',
});

// Open file dialog
const uris = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectMany: false,
    filters: { Executables: ['exe', 'app', ''] },
});
```

---

## Error Handling in Commands

```typescript
vscode.commands.registerCommand('ext.myCommand', async () => {
    try {
        await doWork();
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`MyExtension: ${message}`);
    }
});
```

---

## Checklist for New Commands

- [ ] Command ID declared in `contributes.commands` in `package.json`.
- [ ] Title and category use `%key%` localization placeholders.
- [ ] Command registered in `activate()` and pushed to `context.subscriptions`.
- [ ] Appropriate menu entries added (editor/context, explorer/context, commandPalette, etc.).
- [ ] `when` clauses are as narrow as possible.
- [ ] Long-running commands use `withProgress` and support cancellation.
- [ ] Tests cover at least the happy path of the command.

---

## References

- [Commands API](https://code.visualstudio.com/api/extension-guides/command)
- [vscode.commands namespace](https://code.visualstudio.com/api/references/vscode-api#commands)
- [When Clause Contexts](https://code.visualstudio.com/api/references/when-clause-contexts)
