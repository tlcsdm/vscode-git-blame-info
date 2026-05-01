---
name: vscode-testing-and-debugging
description: Guidance for testing and debugging VS Code extensions with the existing Mocha and @vscode/test-electron setup.
---

# Skill: Testing and Debugging VS Code Extensions

## Overview

VS Code extensions are tested by running them inside a real (or headless) VS Code instance.
Tests use **Mocha** as the test framework and run via `@vscode/test-cli` / `@vscode/test-electron`.
Understanding the test harness and debugging setup is essential for writing reliable tests.

---

## Test Infrastructure

### Dependencies (in `devDependencies`)

```jsonc
"@vscode/test-cli": "^0.0.12",
"@vscode/test-electron": "^2.4.1",
"@types/mocha": "^10.0.0"
```

### `.vscode-test.json` Configuration

```jsonc
{
  "version": "1",
  "tests": [
    {
      "workspaceFolder": "./src/test/fixtures",
      "extensionDevelopmentPath": "${workspaceFolder}",
      "files": "out/test/**/*.test.js"
    }
  ]
}
```

### `package.json` Scripts

```jsonc
"scripts": {
  "pretest": "tsc -p ./ && npm run lint",
  "test": "vscode-test --config ./.vscode-test.json"
}
```

---

## Writing Tests

### Basic Test Structure

```typescript
// src/test/extension.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    suiteSetup(async () => {
        // Wait for extension to activate
        const ext = vscode.extensions.getExtension('publisher.extensionName');
        if (ext && !ext.isActive) {
            await ext.activate();
        }
    });

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('publisher.extensionName'));
    });

    test('Extension should activate', async () => {
        const ext = vscode.extensions.getExtension('publisher.extensionName');
        if (ext) {
            await ext.activate();
            assert.ok(ext.isActive);
        }
    });

    test('Should register expected commands', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('ext.myCommand'));
    });
});
```

### Testing Language Providers

```typescript
suite('Definition Provider Tests', () => {
    let document: vscode.TextDocument;

    suiteSetup(async () => {
        const uri = vscode.Uri.file('/path/to/fixture.fxml');
        document = await vscode.workspace.openTextDocument(uri);
    });

    test('Should provide definition for fx:controller', async () => {
        const position = new vscode.Position(2, 20);
        const locations = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeDefinitionProvider',
            document.uri,
            position
        );
        assert.ok(locations && locations.length > 0, 'Expected at least one definition');
    });
});
```

### Testing Commands

```typescript
test('Should execute openInSceneBuilder command', async () => {
    // Commands that open external processes may be hard to assert;
    // at minimum verify no uncaught exception is thrown.
    const uri = vscode.Uri.file('/path/to/test.fxml');
    await assert.doesNotReject(
        () => vscode.commands.executeCommand('ext.openInSceneBuilder', uri)
    );
});
```

### Testing Configuration

```typescript
test('Should read default configuration', () => {
    const config = vscode.workspace.getConfiguration('myExt');
    const enabled = config.get<boolean>('feature.enabled');
    assert.strictEqual(enabled, true);
});
```

---

## Fixtures

Place test fixture files in `src/test/fixtures/`. Common fixtures:

- Sample `.fxml` files with various element structures
- Sample Java controller files
- Minimal workspace folders with `settings.json`

---

## Test Isolation

- Do not rely on global mutable state between tests; reset it in `setup()` / `teardown()`.
- Use `vscode.workspace.fs` to create/delete temporary files in `globalStorageUri` rather than the real file system.
- Close all documents opened during a test to avoid leaking state.

---

## Running Tests in CI (Headless)

VS Code tests require a display server. Use **Xvfb** in Linux CI:

```yaml
# .github/workflows/build.yml
- name: Install Xvfb
  run: sudo apt-get install -y xvfb

- name: Run tests
  run: xvfb-run -a npm run test
```

Alternatively, use `@vscode/test-electron` with the `--headless` flag (VS Code 1.100+).

---

## Debugging Tests in VS Code

Add a launch configuration in `.vscode/launch.json`:

```jsonc
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Extension Tests",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}",
        "--extensionTestsPath=${workspaceFolder}/out/test/index"
      ],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "preLaunchTask": "${defaultBuildTask}"
    },
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "preLaunchTask": "${defaultBuildTask}"
    }
  ]
}
```

---

## Unit Testing Pure Logic (without VS Code)

Extract pure functions and utilities from provider classes and test them with plain Mocha
(no VS Code instance needed):

```typescript
// src/utils/parseController.ts
export function parseControllerClassName(fxmlContent: string): string | undefined { ... }

// src/test/unit/parseController.test.ts
import * as assert from 'assert';
import { parseControllerClassName } from '../../utils/parseController';

suite('parseControllerClassName', () => {
    test('Returns class name from fx:controller attribute', () => {
        const xml = '<AnchorPane fx:controller="com.example.MyController" />';
        assert.strictEqual(parseControllerClassName(xml), 'com.example.MyController');
    });

    test('Returns undefined for missing attribute', () => {
        assert.strictEqual(parseControllerClassName('<AnchorPane />'), undefined);
    });
});
```

---

## Checklist for New Features

- [ ] At least one integration test verifies the command is registered.
- [ ] Language provider tests use `vscode.commands.executeCommand('vscode.executeXxxProvider', ...)`.
- [ ] Edge cases (empty documents, missing files, invalid input) are tested.
- [ ] CI workflow runs `xvfb-run -a npm run test` (or equivalent).
- [ ] Pure business logic is extracted and tested without VS Code.

---

## References

- [@vscode/test-cli](https://github.com/microsoft/vscode-test-cli)
- [Testing Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Continuous Integration](https://code.visualstudio.com/api/working-with-extensions/continuous-integration)
