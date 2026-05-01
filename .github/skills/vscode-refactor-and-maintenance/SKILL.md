---
name: vscode-refactor-and-maintenance
description: Guidance for refactoring and maintaining VS Code extensions safely across source, contribution metadata, localization, tests, and documentation.
---

# Skill: Refactoring and Maintenance

## Overview

Maintaining and refactoring a VS Code extension requires special care because changes often
span multiple files (`package.json`, TypeScript source, locale files, tests, and documentation).
This guide provides patterns for safe, incremental changes.

---

## Rename a Command

When renaming a command ID (e.g., `ext.oldCommand` → `ext.newCommand`):

1. **`package.json`**
   - `contributes.commands[].command`
   - All `menus.*[].command` references
   - All `keybindings[].command` references
   - `activationEvents` (if listed explicitly)

2. **`src/extension.ts`** (and any module that calls the command)
   - `vscode.commands.registerCommand('ext.newCommand', ...)`
   - `vscode.commands.executeCommand('ext.newCommand', ...)`

3. **`src/test/`**
   - `vscode.commands.getCommands(true)` assertions
   - Direct `executeCommand` calls

4. **`README.md`** — any documentation of the command
5. **`CHANGELOG.md`** — note the rename as a breaking change if published

---

## Add a New Configuration Key

1. Add to `contributes.configuration.properties` in `package.json` (with `%key%` placeholder).
2. Add the English string to `package.nls.json`.
3. Add translated strings to all locale files.
4. Read the value with `vscode.workspace.getConfiguration('ext').get<Type>('keyName')`.
5. React to changes with `vscode.workspace.onDidChangeConfiguration`.
6. Add to `README.md` configuration table.
7. Add to `CHANGELOG.md`.

---

## Add a New Language Feature (Provider)

1. Create `src/<featureName>Provider.ts` implementing the relevant VS Code interface.
2. Add `activationEvents` entry if needed (usually `onLanguage:<id>` is already present).
3. Register in `activate()` with `context.subscriptions.push(vscode.languages.register*(...))`.
4. Add tests in `src/test/`.
5. Update `README.md` features list.
6. Add `CHANGELOG.md` entry.

---

## Deprecate and Remove a Feature

### Safe Deprecation Process

1. **Deprecate** (current release):
   - Mark the setting/command as deprecated in `package.json` using `deprecationMessage`.
   - Show a migration notice to users if they use the deprecated feature.
   - Keep the feature working.

2. **Remove** (next major release):
   - Remove from `package.json`, source, locale files, tests, and README.
   - Document the removal in `CHANGELOG.md` under the major version.

```jsonc
// Deprecating a setting
"ext.oldSetting": {
  "type": "string",
  "deprecationMessage": "Use 'ext.newSetting' instead. This setting will be removed in v2.0.",
  "scope": "resource"
}
```

---

## Upgrade `engines.vscode`

When bumping the minimum VS Code version:

1. Update `engines.vscode` in `package.json`.
2. Update `@types/vscode` in `devDependencies` to match.
3. Remove any compatibility shims for APIs now available in the new minimum.
4. Update CI workflows to test against the new minimum version.
5. Note in `CHANGELOG.md`.

---

## Dependency Updates

```bash
# Check for outdated packages
npm outdated

# Update a single package
npm install <package>@latest --save-dev

# After updating, always run:
npm run compile
npm run lint
npm run test  # if a display is available
```

- Keep `@types/vscode` version aligned with `engines.vscode` (`^1.x.0` where x matches).
- For security fixes in transitive dependencies, use `overrides` in `package.json`.
- Review `package-lock.json` diff carefully before committing dependency updates.

---

## Code Health Patterns

### Extracting Reusable Logic

```typescript
// BEFORE: logic mixed into provider
export class FxmlDefinitionProvider implements vscode.DefinitionProvider {
    provideDefinition(doc, pos, token) {
        // 50 lines of complex parsing inline
    }
}

// AFTER: pure function, easily testable
export function findDefinitionTarget(content: string, offset: number): DefinitionTarget | undefined {
    // parsing logic
}

export class FxmlDefinitionProvider implements vscode.DefinitionProvider {
    provideDefinition(doc, pos, token) {
        const offset = doc.offsetAt(pos);
        const target = findDefinitionTarget(doc.getText(), offset);
        if (!target) { return undefined; }
        return new vscode.Location(vscode.Uri.file(target.filePath), new vscode.Position(target.line, 0));
    }
}
```

### Avoiding God Classes

Keep provider files focused. If a file exceeds ~200 lines, consider splitting:

```
src/
  fxmlParser.ts              Pure XML/FXML parsing (no vscode imports)
  fxmlDefinitionProvider.ts  Thin VS Code adapter
  fxmlHoverProvider.ts       Thin VS Code adapter
```

### Consistent Error Surfaces

```typescript
// Establish a helper for consistent error reporting
function showExtError(message: string, error?: unknown): void {
    const detail = error instanceof Error ? `: ${error.message}` : '';
    vscode.window.showErrorMessage(`JavaFX Support: ${message}${detail}`);
}
```

---

## Refactoring Checklist

Before submitting a refactoring PR:

- [ ] `npm run compile` passes (no TypeScript errors).
- [ ] `npm run lint` passes (no ESLint warnings or errors).
- [ ] All existing tests pass.
- [ ] No behavior change is observable to users (unless explicitly intended).
- [ ] If command IDs changed, all `package.json` references are updated.
- [ ] If settings changed, all locale files are updated.
- [ ] `CHANGELOG.md` notes any breaking changes.
- [ ] `README.md` is updated if the user-facing feature surface changed.

---

## Upgrade Path: esbuild

When upgrading esbuild, verify:

```bash
# Rebuild and check output size
npm install esbuild@latest --save-dev
npm run package
ls -lh dist/extension.js   # should be similar size or smaller
```

Test the packaged extension end-to-end after an esbuild major version upgrade.

---

## References

- [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [Contribution Points](https://code.visualstudio.com/api/references/contribution-points)
- [Extension Samples](https://github.com/microsoft/vscode-extension-samples)
