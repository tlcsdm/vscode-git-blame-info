---
name: vscode-package-json-and-contributes
description: Guidance for updating VS Code extension package.json fields and contributes entries while keeping activation events, menus, and localization aligned.
---

# Skill: `package.json` Contribution Points

## Overview

`package.json` is the single source of truth for everything VS Code knows about an extension
**before** it activates. It is statically parsed by VS Code at startup. Every user-visible
feature (commands, settings, menus, languages, grammars, snippets, etc.) must be declared here.

---

## Key Top-Level Fields

```jsonc
{
  "name": "my-extension",           // npm package name (kebab-case)
  "displayName": "%displayName%",   // shown in Marketplace & Extensions view
  "description": "%description%",
  "version": "1.2.3",               // semver
  "publisher": "myPublisher",
  "engines": { "vscode": "^1.100.0" },
  "main": "./dist/extension.js",
  "activationEvents": [...],
  "contributes": { ... }
}
```

---

## `activationEvents`

| Event | When to use |
|---|---|
| `onLanguage:<id>` | Extension serves a specific language |
| `onCommand:<id>` | Command invoked from Command Palette or menu |
| `onStartupFinished` | Delay until after all eager extensions load |
| `workspaceContains:<glob>` | Workspace contains specific files |
| `*` | **Avoid** — eager activation harms startup time |

> **Tip:** As of VS Code 1.74, most `onCommand:` events are inferred automatically.
> You still need `onLanguage:` and `workspaceContains:` explicitly.

---

## `contributes.commands`

```jsonc
"commands": [
  {
    "command": "ext.myCommand",
    "title": "%command.myCommand.title%",
    "category": "%command.myCommand.category%",
    "icon": "$(symbol-method)",        // ThemeIcon or { light, dark } paths
    "enablement": "editorLangId == fxml"  // optional condition
  }
]
```

- Every `command` value must be registered in TypeScript via `vscode.commands.registerCommand`.
- Use `%key%` placeholders for all user-visible strings.
- `category` groups the command in the Command Palette under `Category: Title`.

---

## `contributes.menus`

```jsonc
"menus": {
  "editor/context": [
    {
      "command": "ext.myCommand",
      "when": "resourceLangId == fxml",
      "group": "navigation"
    }
  ],
  "explorer/context": [...],
  "editor/title": [...],
  "commandPalette": [
    { "command": "ext.internalCommand", "when": "false" }  // hide from palette
  ]
}
```

`group` controls ordering: `navigation`, `1_modification`, `9_cutcopypaste`, `z_commands`.

---

## `contributes.configuration`

```jsonc
"configuration": {
  "title": "%config.title%",
  "properties": {
    "ext.myFeature.enabled": {
      "type": "boolean",
      "default": true,
      "description": "%config.myFeature.enabled.description%",
      "scope": "resource"  // "application" | "machine" | "window" | "resource" | "language-overridable"
    }
  }
}
```

- Use `"scope": "resource"` for workspace-folder-level settings (most common).
- Use `"scope": "machine"` for paths to external executables (e.g., Scene Builder path).
- Add `"markdownDescription"` for rich hover documentation with links and code.

---

## `contributes.languages`

```jsonc
"languages": [
  {
    "id": "fxml",
    "aliases": ["FXML", "fxml"],
    "extensions": [".fxml"],
    "configuration": "./language-configuration.json",
    "icon": { "light": "./images/fxml-light.svg", "dark": "./images/fxml-dark.svg" }
  }
]
```

`language-configuration.json` defines brackets, comments, auto-closing pairs, and indentation rules.

---

## `contributes.grammars`

```jsonc
"grammars": [
  {
    "language": "fxml",
    "scopeName": "source.fxml",
    "path": "./syntaxes/fxml.tmLanguage.json"
  }
]
```

- `scopeName` must match the `scopeName` field inside the `.tmLanguage.json` file.
- Injected grammars use `"injectTo": ["source.java"]` to augment another language.

---

## `contributes.snippets`

```jsonc
"snippets": [
  { "language": "fxml", "path": "./snippets/fxml.json" }
]
```

---

## `contributes.keybindings`

```jsonc
"keybindings": [
  {
    "command": "ext.myCommand",
    "key": "ctrl+shift+o",
    "mac": "cmd+shift+o",
    "when": "editorLangId == fxml"
  }
]
```

---

## `contributes.configurationDefaults`

Override default settings for a language or globally:

```jsonc
"configurationDefaults": {
  "[fxml]": {
    "editor.semanticHighlighting.enabled": false,
    "editor.formatOnSave": true
  }
}
```

---

## Checklist for `package.json` Changes

- [ ] All new `%key%` placeholders exist in `package.nls.json` (and other locale files).
- [ ] New commands are registered in `activate()` in TypeScript.
- [ ] `engines.vscode` is not bumped unless the new API requires it.
- [ ] `activationEvents` includes any new language or command triggers if needed.
- [ ] After changes, run `npm run compile` to verify no TypeScript errors.
- [ ] After changes, run `npm run lint` to verify no ESLint errors.

---

## References

- [Contribution Points](https://code.visualstudio.com/api/references/contribution-points)
- [Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest)
- [When Clause Contexts](https://code.visualstudio.com/api/references/when-clause-contexts)
