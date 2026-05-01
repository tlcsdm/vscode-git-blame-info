---
name: vscode-performance-and-compatibility
description: Guidance for improving VS Code extension performance, responsiveness, and compatibility across supported VS Code versions.
---

# Skill: Performance and Compatibility

## Overview

VS Code extensions run inside the **extension host** process. Slow extensions degrade the
entire VS Code experience. This guide covers the most important performance and compatibility
considerations for extension authors.

---

## Activation Performance

### Minimize `activate()` Work

`activate()` blocks loading of the extension and its contribution points. Keep it fast:

```typescript
// BAD: Scanning the workspace synchronously on activation
export function activate(context: vscode.ExtensionContext): void {
    const allFiles = fs.readdirSync(workspacePath); // ❌ blocks
}

// GOOD: Lazy initialization on first use
let index: FileIndex | undefined;
function getIndex(): FileIndex {
    if (!index) {
        index = new FileIndex(); // built on first provider call
    }
    return index;
}
```

### Narrow Activation Events

```jsonc
// BAD
"activationEvents": ["*"]

// GOOD
"activationEvents": ["onLanguage:fxml", "onLanguage:java"]
```

Use `onStartupFinished` only for truly background tasks.

### Measure Activation Time

Use the built-in VS Code developer tools:
- Open `Help > Toggle Developer Tools > Performance`
- Filter by `[Extension Host]` to see extension activation time
- Target: `activate()` should complete in under **50 ms** on a cold start

---

## Async I/O

Never use synchronous file I/O APIs in extension code:

```typescript
// BAD
const content = fs.readFileSync(filePath, 'utf8'); // ❌ blocks event loop

// GOOD (Node.js fs.promises)
const content = await fs.promises.readFile(filePath, 'utf8');

// GOOD (VS Code workspace FS — works in all schemes including remote)
const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
const content = Buffer.from(bytes).toString('utf8');
```

Always prefer `vscode.workspace.fs` over Node.js `fs` — it works transparently with
Remote SSH, Dev Containers, and virtual file systems.

---

## Cancellation Tokens

Provider methods receive a `CancellationToken`. Respect it in loops:

```typescript
async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
): Promise<vscode.Location[] | undefined> {
    for (const file of largeFileList) {
        if (token.isCancellationRequested) { return undefined; }
        await processFile(file);
    }
    return results;
}
```

---

## Debouncing and Throttling

For event-driven updates (e.g., re-validating on every keystroke), debounce expensive work:

```typescript
let debounceTimer: NodeJS.Timeout | undefined;

context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            validateDocument(event.document);
        }, 300); // wait 300 ms after the last change
    })
);
```

---

## Caching

Cache parsed results keyed on `document.version` to avoid redundant work:

```typescript
const cache = new Map<string, { version: number; result: ParseResult }>();

function getParsed(document: vscode.TextDocument): ParseResult {
    const cached = cache.get(document.uri.toString());
    if (cached && cached.version === document.version) {
        return cached.result;
    }
    const result = expensiveParse(document.getText());
    cache.set(document.uri.toString(), { version: document.version, result });
    return result;
}
```

Evict cache entries when documents close:

```typescript
context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => cache.delete(doc.uri.toString()))
);
```

---

## Memory Management

- Dispose all event listeners and providers when the extension deactivates.
- Avoid retaining large buffers or ASTs in memory beyond their useful life.
- Use `WeakMap<vscode.TextDocument, ...>` for per-document state when possible (GC-friendly).
- Clear `Map` / `Set` caches on workspace folder change.

---

## Extension Host vs. UI Process

- Extension code runs in the **Node.js extension host** — no direct DOM access.
- Webview content runs in an isolated **Browser renderer** — no direct `vscode` API access.
- Communication between the two is **async message passing** only.
- Never assume synchronous state between the webview and the extension.

---

## VS Code Version Compatibility

- `engines.vscode` in `package.json` defines the **minimum** VS Code version.
- Before using a new API, check its `@since` tag in the `vscode.d.ts` typings.
- Use optional chaining for APIs that may not exist in older VS Code versions:

```typescript
// API added in VS Code 1.75
const tab = vscode.window.tabGroups?.activeTabGroup?.activeTab;
```

- Test against the minimum declared VS Code version in CI by passing `--vscodeVersion` to `@vscode/test-cli`.

---

## Extension Size

Keep the packaged `.vsix` small:

- Use esbuild's `bundle: true` to tree-shake unused code.
- List development-only paths in `.vscodeignore`.
- Use `npx @vscode/vsce ls` to audit what is included.
- Avoid bundling large data files; load them lazily from `extensionUri`.

---

## Performance Checklist

- [ ] `activate()` completes in < 50 ms for cold start.
- [ ] No synchronous file I/O (`readFileSync`, `existsSync`, `statSync`) in hot paths.
- [ ] Provider methods respect `token.isCancellationRequested`.
- [ ] Document parsing results are cached by `document.version`.
- [ ] Expensive work triggered by document changes is debounced.
- [ ] All disposables are pushed to `context.subscriptions`.
- [ ] No memory leaks: caches are evicted when documents close.

---

## References

- [Extension Performance Guide](https://code.visualstudio.com/api/advanced-topics/extension-host)
- [VS Code API — CancellationToken](https://code.visualstudio.com/api/references/vscode-api#CancellationToken)
- [Remote Development](https://code.visualstudio.com/api/advanced-topics/remote-extensions)
- [workspace.fs](https://code.visualstudio.com/api/references/vscode-api#FileSystem)
