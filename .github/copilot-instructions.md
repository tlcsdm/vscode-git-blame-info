# Copilot Instructions for VS Code Extension Development

## Repository Overview

This repository is a **VS Code extension** written in **TypeScript** and built with **esbuild**.
The extension currently focuses on **JavaFX/FXML developer experience** (syntax highlighting,
Scene Builder integration, code navigation, formatting, and outline support for `.fxml` files),
but the patterns and conventions here are broadly reusable across VS Code extension repositories
under the `tlcsdm` organization.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict) |
| Bundler | esbuild (`esbuild.mjs`) |
| Linter | ESLint + typescript-eslint (`eslint.config.mjs`) |
| Test runner | `@vscode/test-cli` + Mocha (`@vscode/test-electron`) |
| Packaging | `@vscode/vsce` |
| CI | GitHub Actions (`.github/workflows/`) |
| Localization | `package.nls.json` + `package.nls.{locale}.json` |

---

## Project Layout

```
src/                    TypeScript source files
  extension.ts          Entry point — activate() and deactivate()
  *.ts                  Feature modules (providers, utilities)
  test/                 Mocha test suites (run inside VS Code)
syntaxes/               TextMate grammars (.tmLanguage.json)
images/                 Extension icons and assets
dist/                   Compiled output (git-ignored)
package.json            Extension manifest and contribution points
package.nls.json        English localization strings
package.nls.zh-cn.json  Simplified Chinese strings
package.nls.ja.json     Japanese strings
language-configuration.json  Language bracket/comment rules
esbuild.mjs             Build script
eslint.config.mjs       ESLint configuration
tsconfig.json           TypeScript configuration
.github/workflows/      CI workflows (build, test, publish, release)
.github/skills/         Reusable Copilot skill guides (see below)
```

---

## Coordinated Change Rule

> **Whenever you change extension behavior, update ALL of the following that are affected:**
>
> 1. `src/` — TypeScript implementation
> 2. `package.json` — contribution points (commands, configuration, menus, languages, grammars)
> 3. `package.nls.json` — English localization keys/values
> 4. `package.nls.zh-cn.json` and other locale files — translated values
> 5. `README.md` — user-facing documentation
> 6. `CHANGELOG.md` — release notes entry
> 7. `src/test/` — unit/integration tests

Failing to keep these in sync is the most common source of bugs and broken releases.

---

## Development Workflows

```bash
# Install dependencies
npm install

# Type-check without emitting (fast feedback)
npm run check-types

# Compile for development
npm run compile

# Watch mode
npm run watch

# Lint
npm run lint

# Run tests (requires a display / VS Code instance)
npm run test

# Production bundle (minified, no source maps)
npm run package

# Package as .vsix
npx @vscode/vsce package
```

---

## Coding Conventions

### TypeScript
- All files use **strict TypeScript** (`tsconfig.json` enforces this).
- Prefer `const` and `readonly`; avoid `any`.
- Use `vscode.ExtensionContext.subscriptions.push(...)` for all disposables registered in `activate()`.
- Never store global mutable state; thread context through function parameters or classes.
- Export only what is needed by other modules; keep internals `private` or unexported.

### Naming
- Commands: `<publisher>.<extensionName>.<verb><Object>` — e.g., `tlcsdm.javafxSupport.openInSceneBuilder`
- Configuration keys: `<publisher>.<extensionName>.<section>.<key>` — e.g., `tlcsdm.javafxSupport.sceneBuilderPath`
- TypeScript classes: `PascalCase`; functions and variables: `camelCase`

### Error Handling
- Surface errors to users via `vscode.window.showErrorMessage(...)`, not bare `console.error`.
- Use `vscode.window.showWarningMessage(...)` for recoverable issues.
- Catch and handle promise rejections; do not let unhandled rejections crash the extension host.

### Localization
- Every user-facing string in `package.json` must use a `%key%` placeholder.
- The key must exist in `package.nls.json` (English), and a best-effort translation in every other locale file.
- Strings inside TypeScript source are currently inline; use `vscode.l10n.t(...)` for new strings if i18n is needed in code.

### Provider Pattern
- Implement VS Code provider interfaces (`vscode.DefinitionProvider`, `vscode.DocumentSymbolProvider`, etc.) as named classes in dedicated files.
- Register providers in `activate()` via `context.subscriptions.push(vscode.languages.register*(...))`.
- Keep provider logic pure and testable; avoid side effects in provider methods.

### Menus and When-Clauses
- Use the narrowest `when` clause possible for menu contributions.
- Prefer built-in context keys (`resourceLangId`, `editorLangId`) over custom context keys where sufficient.

### Commit Messages
- Follow the **Angular commit convention** for all commits.
- Use the format: `<type>(<scope>): <subject>` when a scope is helpful, or `<type>: <subject>` when it is not.
- Prefer common types such as `feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`, `style` and `chore`.
- Keep the subject concise, imperative, and lowercase where practical.
- Examples:
  - `feat(fxml): add controller navigation`
  - `fix(scene-builder): handle missing executable path`
  - `docs(copilot): add vscode extension skill guidance`

---

## Extension Activation

- `activationEvents` in `package.json` controls when the extension loads.
- Prefer `onLanguage:<id>` events over `*` (eager activation) to reduce startup impact.
- Keep `activate()` fast: defer expensive work (file system scans, network calls) using lazy initialization or `onDidOpenTextDocument`.

---

## Security Considerations

- Never execute untrusted user input as shell commands without validation and escaping.
- When spawning child processes (e.g., launching Scene Builder), sanitize all path arguments.
- Do not write to arbitrary file system paths based on user or workspace input without confirmation.
- Avoid `eval` and dynamic `require` inside the extension bundle.

---

## Skills Reference

Detailed, reusable guides are in `.github/skills/`. Consult them when working on these areas:

| Topic | File |
|---|---|
| Extension architecture & patterns | `.github/skills/vscode-extension-architecture/SKILL.md` |
| `package.json` contribution points | `.github/skills/vscode-package-json-and-contributes/SKILL.md` |
| Commands & activation | `.github/skills/vscode-commands-and-activation/SKILL.md` |
| Language features & providers | `.github/skills/vscode-language-features/SKILL.md` |
| Webviews & native VS Code UI | `.github/skills/vscode-webview-and-ui/SKILL.md` |
| Configuration & settings | `.github/skills/vscode-configuration-and-settings/SKILL.md` |
| Testing & debugging | `.github/skills/vscode-testing-and-debugging/SKILL.md` |
| Build, packaging & release | `.github/skills/vscode-build-package-and-release/SKILL.md` |
| i18n & documentation | `.github/skills/vscode-i18n-and-docs/SKILL.md` |
| Performance & compatibility | `.github/skills/vscode-performance-and-compatibility/SKILL.md` |
| Refactoring & maintenance | `.github/skills/vscode-refactor-and-maintenance/SKILL.md` |
