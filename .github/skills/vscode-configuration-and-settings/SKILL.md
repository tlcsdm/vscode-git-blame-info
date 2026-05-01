---
name: vscode-configuration-and-settings
description: Guidance for declaring, reading, updating, and reacting to VS Code extension configuration and settings changes safely.
---

# Skill: Configuration and Settings

## Overview

VS Code settings (configuration) let users customize extension behavior at the application,
machine, workspace, or folder level. This guide covers how to declare, read, write, and
react to configuration changes.

---

## Declaring Configuration in `package.json`

```jsonc
"contributes": {
  "configuration": {
    "title": "%config.title%",
    "properties": {
      "myExt.feature.enabled": {
        "type": "boolean",
        "default": true,
        "description": "%config.feature.enabled.description%",
        "scope": "resource"
      },
      "myExt.executablePath": {
        "type": "string",
        "default": "",
        "markdownDescription": "%config.executablePath.markdownDescription%",
        "scope": "machine"
      },
      "myExt.maxResults": {
        "type": "integer",
        "default": 100,
        "minimum": 1,
        "maximum": 1000,
        "description": "%config.maxResults.description%",
        "scope": "resource"
      },
      "myExt.mode": {
        "type": "string",
        "default": "auto",
        "enum": ["auto", "manual", "off"],
        "enumDescriptions": [
          "%config.mode.auto.description%",
          "%config.mode.manual.description%",
          "%config.mode.off.description%"
        ],
        "scope": "window"
      }
    }
  }
}
```

### Scope Reference

| Scope | Use when |
|---|---|
| `application` | Applies to all VS Code instances (e.g., UI preferences) |
| `machine` | Machine-specific (e.g., path to an external executable) |
| `machine-overridable` | Machine default, but user can override in workspace |
| `window` | Per-window (workspace group) setting |
| `resource` | Per-workspace-folder; most common for project settings |
| `language-overridable` | Can be overridden per-language in `[languageId]` blocks |

---

## Reading Configuration

```typescript
// Get a workspace-folder-scoped value (preferred for 'resource' scope settings)
function getConfig<T>(key: string, uri?: vscode.Uri, fallback?: T): T | undefined {
    return vscode.workspace.getConfiguration('myExt', uri).get<T>(key) ?? fallback;
}

// Usage
const enabled = getConfig<boolean>('feature.enabled', document.uri, true);
const execPath = getConfig<string>('executablePath');

// Get the full configuration object for the extension
const config = vscode.workspace.getConfiguration('myExt');
const maxResults = config.get<number>('maxResults', 100);
```

---

## Writing Configuration

```typescript
const config = vscode.workspace.getConfiguration('myExt');

// Update in user settings (global)
await config.update('executablePath', '/usr/bin/my-tool', vscode.ConfigurationTarget.Global);

// Update in workspace settings
await config.update('feature.enabled', false, vscode.ConfigurationTarget.Workspace);

// Update in workspace folder settings (resource scope)
await config.update('feature.enabled', false, vscode.ConfigurationTarget.WorkspaceFolder);
```

---

## Reacting to Configuration Changes

```typescript
context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('myExt.executablePath')) {
            resetToolPath();
        }
        if (event.affectsConfiguration('myExt.feature')) {
            refreshProviders();
        }
    })
);
```

`event.affectsConfiguration(section, resource?)` returns `true` if the specified section
changed, optionally scoped to a resource URI.

---

## Configuration Defaults Override

You can set default values for built-in settings per language:

```jsonc
"configurationDefaults": {
  "[fxml]": {
    "editor.semanticHighlighting.enabled": false,
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "myPublisher.myExtension"
  }
}
```

---

## Contributed Default Formatter

To register your extension as the default formatter for a language:

```jsonc
"configurationDefaults": {
  "[fxml]": {
    "editor.defaultFormatter": "myPublisher.myExtension"
  }
}
```

And implement `vscode.DocumentFormattingEditProvider` (see Language Features skill).

---

## Settings UI Enhancements

- Use `markdownDescription` (instead of `description`) to support links and code blocks in the Settings UI.
- Use `order` (integer) to control the visual order of properties in the Settings UI within the same section.
- Use `tags` to mark settings (e.g., `["experimental"]`).
- Use `deprecationMessage` to mark deprecated settings and guide users to the replacement.

```jsonc
"myExt.oldSetting": {
  "type": "string",
  "deprecationMessage": "Use myExt.newSetting instead.",
  "scope": "resource"
}
```

---

## Pattern: Configuration Service Class

For extensions with many settings, encapsulate reading logic:

```typescript
export class ExtensionConfig {
    private static get config() {
        return vscode.workspace.getConfiguration('myExt');
    }

    static get executablePath(): string {
        return this.config.get<string>('executablePath', '');
    }

    static get isEnabled(): boolean {
        return this.config.get<boolean>('feature.enabled', true);
    }

    static async setExecutablePath(value: string): Promise<void> {
        await this.config.update('executablePath', value, vscode.ConfigurationTarget.Global);
    }
}
```

---

## Checklist for New Settings

- [ ] Declared in `contributes.configuration.properties` in `package.json`.
- [ ] `scope` is set to the narrowest appropriate level (`resource` for most project settings, `machine` for tool paths).
- [ ] Description key exists in `package.nls.json` (and translated locale files).
- [ ] Default value is sensible and safe.
- [ ] Extension reacts to configuration changes via `onDidChangeConfiguration` if the setting affects runtime behavior.
- [ ] Added to `README.md` configuration table.

---

## References

- [Configuration API](https://code.visualstudio.com/api/references/vscode-api#WorkspaceConfiguration)
- [Contribution Points: configuration](https://code.visualstudio.com/api/references/contribution-points#contributes.configuration)
- [Configuration Scopes](https://code.visualstudio.com/api/references/contribution-points#Configuration-property-schema)
