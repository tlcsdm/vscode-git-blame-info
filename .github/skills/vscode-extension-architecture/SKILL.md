---
name: vscode-extension-architecture
description: Guidance for implementing and modifying VS Code extension architecture, activation flow, disposables, and extension-host-safe patterns.
---

# Skill: VS Code Extension Architecture

## Overview

A VS Code extension is a Node.js package that runs inside the VS Code **extension host** process,
a sandboxed Node.js runtime that communicates with the UI renderer process through a typed API
(`vscode` module). Understanding this boundary is essential for writing correct and performant extensions.

---

## Key Architectural Concepts

### Extension Host

- Extensions run in a separate Node.js process from the VS Code UI.
- The `vscode` module is the only allowed IPC channel to VS Code APIs; all other Node.js modules (fs, child_process, etc.) work normally.
- Extensions **must not** perform long-running synchronous work on the extension host event loop — this freezes VS Code's language-related features.
- Extensions in Remote (SSH/Container/WSL) scenarios run on the remote machine; the Webview content runs on the local UI. Keep this split in mind for network/file access.

### Entry Point

```typescript
// src/extension.ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
    // Register disposables into context.subscriptions
    // so they are automatically cleaned up on deactivation.
}

export function deactivate(): void {
    // Optional: synchronous teardown.
    // Async teardown: return a Promise.
}
```

### Disposable Pattern

Always push every registration into `context.subscriptions`:

```typescript
context.subscriptions.push(
    vscode.commands.registerCommand('ext.command', handler),
    vscode.languages.registerHoverProvider(selector, provider),
    vscode.workspace.onDidChangeConfiguration(handler),
);
```

`vscode.Disposable.from(...)` is useful for grouping multiple disposables.

### Feature Module Pattern

Organize large extensions into feature modules:

```
src/
  extension.ts         activate() wires up all features
  featureName.ts       or featureName/index.ts for larger features
  featureName/
    provider.ts        VS Code provider class
    logic.ts           Pure domain logic (easily unit-testable)
    types.ts           Shared types
```

Keep provider classes thin — delegate real logic to pure functions or services.

### Lazy Initialization

Avoid doing expensive work (parsing, indexing, spawning) in `activate()`.
Prefer initialization inside the first provider call or on document open:

```typescript
let cache: Map<string, Result> | undefined;

function getCache() {
    if (!cache) {
        cache = buildCache(); // expensive, done once on first use
    }
    return cache;
}
```

Invalidate caches on `vscode.workspace.onDidChangeTextDocument` or `onDidSaveTextDocument`.

---

## Extension Manifest (`package.json`) Highlights

- `"main"` points to the compiled entry point (`./dist/extension.js`).
- `"activationEvents"` controls when the extension host loads the extension.
- `"contributes"` declares all static contribution points (commands, config, grammars, etc.).
- `"engines.vscode"` sets the minimum VS Code version; bump only when needed.

---

## Common Anti-Patterns to Avoid

| Anti-pattern | Correct approach |
|---|---|
| `activate: "*"` | Use `onLanguage:`, `onCommand:`, or `onStartupFinished` |
| Synchronous file I/O in providers | Use `fs.promises` / `vscode.workspace.fs` (async) |
| Storing VS Code objects in global state | Pass through `ExtensionContext` or class constructor |
| Ignoring the return value of `register*` | Always push the disposable into subscriptions |
| Throwing exceptions in provider methods | Return `undefined`/`[]` or log + show error message |
| `require()` inside hot paths | Import at the top of the module (bundled by esbuild) |

---

## Extension Context

`vscode.ExtensionContext` provides:

| Property | Purpose |
|---|---|
| `subscriptions` | Lifecycle-managed disposables |
| `extensionUri` | Absolute URI to the extension root (use for assets) |
| `globalState` / `workspaceState` | Persistent key-value stores |
| `secrets` | Encrypted secret storage |
| `globalStorageUri` | Writable directory outside the workspace |
| `asAbsolutePath(rel)` | Resolves relative path to absolute (legacy; prefer `extensionUri`) |

---

## TypeScript Configuration

- Use `"strict": true` in `tsconfig.json`.
- Set `"module": "commonjs"` and `"target": "es2022"` (or as required by the minimum VS Code version).
- Use `"lib": ["es2022"]` — the `vscode` module typings augment this.
- Do not include `"node_modules"` or `"dist"` in compilation.

---

## References

- [VS Code API](https://code.visualstudio.com/api/references/vscode-api)
- [Extension Anatomy](https://code.visualstudio.com/api/get-started/extension-anatomy)
- [Extension Host](https://code.visualstudio.com/api/advanced-topics/extension-host)
