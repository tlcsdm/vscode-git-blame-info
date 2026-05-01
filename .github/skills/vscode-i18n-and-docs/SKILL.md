---
name: vscode-i18n-and-docs
description: Guidance for keeping VS Code extension localization, package.nls files, README content, and changelog updates in sync.
---

# Skill: Internationalization (i18n) and Documentation

## Overview

VS Code extensions support localization through `package.nls.json` files for `package.json`
strings, and through the `@vscode/l10n` library for strings in TypeScript source.
This guide covers both mechanisms and documentation conventions.

---

## Localization Architecture

```
package.nls.json          English (base, required)
package.nls.zh-cn.json    Simplified Chinese
package.nls.ja.json       Japanese
package.nls.<locale>.json Any additional locale
```

VS Code automatically picks the appropriate file based on the display language.
If a key is missing from a locale file, VS Code falls back to `package.nls.json`.

---

## Localizing `package.json` Strings

Use `%key%` placeholders for all user-visible strings in `package.json`:

```jsonc
// package.json
"displayName": "%displayName%",
"commands": [
  {
    "command": "ext.myCommand",
    "title": "%command.myCommand.title%",
    "category": "%command.myCommand.category%"
  }
],
"configuration": {
  "properties": {
    "ext.feature.enabled": {
      "description": "%config.feature.enabled.description%"
    }
  }
}
```

```jsonc
// package.nls.json (English — source of truth)
{
  "displayName": "My Extension",
  "command.myCommand.title": "Do Something",
  "command.myCommand.category": "My Extension",
  "config.feature.enabled.description": "Enable the feature."
}
```

```jsonc
// package.nls.zh-cn.json (Simplified Chinese)
{
  "displayName": "我的扩展",
  "command.myCommand.title": "执行操作",
  "command.myCommand.category": "我的扩展",
  "config.feature.enabled.description": "启用此功能。"
}
```

---

## Localizing TypeScript Source Strings

For strings that appear in TypeScript (notifications, labels, etc.), use `@vscode/l10n`:

```bash
npm install @vscode/l10n
```

```typescript
import * as l10n from '@vscode/l10n';

// Simple string
vscode.window.showInformationMessage(l10n.t('Operation complete.'));

// String with placeholders
vscode.window.showErrorMessage(l10n.t('Failed to open {0}: {1}', filePath, error.message));
```

Extract strings for translation:

```bash
npx @vscode/l10n-dev export --outDir ./l10n ./src
```

This generates `l10n/bundle.l10n.json` (English strings for the Marketplace).

---

## Key Naming Conventions

Use a hierarchical, dot-separated naming scheme:

| Pattern | Example |
|---|---|
| `displayName` | `"displayName"` |
| `command.<commandId>.<field>` | `"command.openInSceneBuilder.title"` |
| `config.<sectionPath>.<field>` | `"config.sceneBuilderPath.description"` |
| `view.<viewId>.<field>` | `"view.myTree.name"` |
| `notification.<id>.<field>` | `"notification.updateAvailable.message"` |

---

## Keeping Locale Files in Sync

**When adding a new user-visible string:**

1. Add the `%key%` placeholder in `package.json`.
2. Add the key + English value to `package.nls.json`.
3. Add the key + translated value to **every** locale file (`package.nls.zh-cn.json`, `package.nls.ja.json`, etc.).
4. If translation is not yet available, copy the English value as a placeholder.

**When removing a string:**

1. Remove the `%key%` from `package.json`.
2. Remove the key from `package.nls.json` and all locale files.

---

## Documentation Conventions

### `README.md` Structure

```markdown
# Extension Name

Brief one-sentence description.

## Features
- Feature 1: ...
- Feature 2: ...

## Installation
...

## Usage
...

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `ext.feature.enabled` | ... | `true` |

## Requirements
...

## Known Issues
...

## Release Notes
See [CHANGELOG.md](CHANGELOG.md).

## License
MIT
```

### `CHANGELOG.md` Structure

Follow [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Changelog

## [Unreleased]

## [1.1.0] - 2025-06-01
### Added
- New feature X
### Fixed
- Bug Y

## [1.0.3] - 2025-05-01
### Fixed
- ...
```

---

## Localization Checklist

- [ ] Every `%key%` in `package.json` exists in `package.nls.json`.
- [ ] `package.nls.json` has no orphan keys (keys not referenced by `package.json`).
- [ ] All locale files contain the same set of keys as `package.nls.json`.
- [ ] New TypeScript strings use `@vscode/l10n` if l10n infrastructure is set up.
- [ ] `CHANGELOG.md` has an entry for every user-visible change.
- [ ] `README.md` configuration table includes all new settings.

---

## Tooling

```bash
# Check for missing/extra keys between nls files (custom script or manual diff)
node -e "
const en = Object.keys(require('./package.nls.json'));
const zh = Object.keys(require('./package.nls.zh-cn.json'));
const missing = en.filter(k => !zh.includes(k));
const extra = zh.filter(k => !en.includes(k));
if (missing.length) console.log('Missing in zh-cn:', missing);
if (extra.length) console.log('Extra in zh-cn:', extra);
"
```

---

## References

- [Localization Extension Guide](https://code.visualstudio.com/api/references/extension-manifest#Localization)
- [@vscode/l10n](https://github.com/microsoft/vscode-l10n)
- [@vscode/l10n-dev](https://github.com/microsoft/vscode-l10n/tree/main/l10n-dev)
- [Keep a Changelog](https://keepachangelog.com/)
