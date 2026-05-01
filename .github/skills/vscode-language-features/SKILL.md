---
name: vscode-language-features
description: Guidance for implementing VS Code language features such as definitions, hovers, completions, symbols, diagnostics, formatting, and related providers.
---

# Skill: Language Features and Providers

## Overview

VS Code exposes a rich set of language feature APIs through the `vscode.languages` namespace.
Each feature is implemented as a **provider** — a class or object that implements a well-defined
interface and is registered for a specific `DocumentSelector`.

---

## Document Selector

```typescript
// Match by language ID
const fxmlSelector: vscode.DocumentSelector = { language: 'fxml', scheme: 'file' };

// Match by file pattern
const xmlSelector: vscode.DocumentSelector = { pattern: '**/*.xml', scheme: 'file' };

// Multiple selectors (array)
const multiSelector: vscode.DocumentSelector = [
    { language: 'fxml', scheme: 'file' },
    { language: 'fxml', scheme: 'untitled' },
];
```

Always include `scheme: 'file'` unless you explicitly want to serve virtual documents too.

---

## Provider Interfaces

### Definition Provider

```typescript
import * as vscode from 'vscode';

export class MyDefinitionProvider implements vscode.DefinitionProvider {
    provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
        const word = document.getWordRangeAtPosition(position);
        if (!word) { return undefined; }
        // Resolve to a Location or LocationLink
        return new vscode.Location(
            vscode.Uri.file('/path/to/target.fxml'),
            new vscode.Position(10, 0)
        );
    }
}
```

### Hover Provider

```typescript
export class MyHoverProvider implements vscode.HoverProvider {
    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        const range = document.getWordRangeAtPosition(position);
        if (!range) { return undefined; }
        const word = document.getText(range);
        return new vscode.Hover(new vscode.MarkdownString(`**${word}** — documentation here`), range);
    }
}
```

### Completion Provider

```typescript
export class MyCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const item = new vscode.CompletionItem('mySnippet', vscode.CompletionItemKind.Snippet);
        item.insertText = new vscode.SnippetString('mySnippet(${1:arg})');
        item.documentation = new vscode.MarkdownString('Insert a my-snippet call.');
        return [item];
    }
}
```

### Document Symbol Provider (Outline)

```typescript
export class MyDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    provideDocumentSymbols(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
        const symbols: vscode.DocumentSymbol[] = [];
        // Parse document and build symbol tree
        return symbols;
    }
}
```

### CodeLens Provider

```typescript
export class MyCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    provideCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.CodeLens[]> {
        const lenses: vscode.CodeLens[] = [];
        // Add lenses at specific ranges
        const range = new vscode.Range(0, 0, 0, 0);
        lenses.push(new vscode.CodeLens(range, {
            title: 'Go to FXML',
            command: 'ext.goToFxml',
            arguments: ['ControllerClass', 'memberName', false],
        }));
        return lenses;
    }
}
```

### Document Formatting Provider

```typescript
export class MyFormattingProvider implements vscode.DocumentFormattingEditProvider {
    provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.TextEdit[]> {
        const edits: vscode.TextEdit[] = [];
        // Add TextEdit.replace / TextEdit.insert / TextEdit.delete
        return edits;
    }
}
```

---

## Registering Providers in `activate()`

```typescript
export function activate(context: vscode.ExtensionContext): void {
    const fxmlSelector: vscode.DocumentSelector = { language: 'fxml', scheme: 'file' };
    const javaSelector: vscode.DocumentSelector = { language: 'java', scheme: 'file' };

    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(fxmlSelector, new MyDefinitionProvider()),
        vscode.languages.registerHoverProvider(fxmlSelector, new MyHoverProvider()),
        vscode.languages.registerCompletionItemProvider(fxmlSelector, new MyCompletionProvider(), '.', ':'),
        vscode.languages.registerDocumentSymbolProvider(fxmlSelector, new MyDocumentSymbolProvider()),
        vscode.languages.registerCodeLensProvider(javaSelector, new MyCodeLensProvider()),
        vscode.languages.registerDocumentFormattingEditProvider(fxmlSelector, new MyFormattingProvider()),
    );
}
```

---

## Diagnostics (Error Squiggles)

```typescript
const diagnosticCollection = vscode.languages.createDiagnosticCollection('myExtension');
context.subscriptions.push(diagnosticCollection);

function validateDocument(document: vscode.TextDocument): void {
    const diagnostics: vscode.Diagnostic[] = [];
    const range = new vscode.Range(0, 0, 0, 10);
    const diagnostic = new vscode.Diagnostic(range, 'Something is wrong', vscode.DiagnosticSeverity.Error);
    diagnostic.source = 'myExtension';
    diagnostics.push(diagnostic);
    diagnosticCollection.set(document.uri, diagnostics);
}
```

---

## TextMate Grammars

For syntax highlighting, register a grammar in `package.json`:

```jsonc
"grammars": [
  {
    "language": "fxml",
    "scopeName": "source.fxml",
    "path": "./syntaxes/fxml.tmLanguage.json"
  }
]
```

The `.tmLanguage.json` file follows TextMate grammar rules:
- `patterns` — array of match rules
- `repository` — reusable rule definitions
- `match` — single-line regex
- `begin`/`end` — multi-line block
- `captures` — map capture groups to scope names

---

## Semantic Tokens (Advanced Highlighting)

```typescript
const legend = new vscode.SemanticTokensLegend(['class', 'variable'], ['declaration']);

export class MySemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    provideDocumentSemanticTokens(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.SemanticTokens> {
        const builder = new vscode.SemanticTokensBuilder(legend);
        // builder.push(line, startChar, length, tokenType, tokenModifiers)
        return builder.build();
    }
}

context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(selector, new MySemanticTokensProvider(), legend)
);
```

---

## Performance Tips

- Return `undefined` early from provider methods when the position/document is not relevant.
- Respect `token.isCancellationRequested` in long-running parsing loops.
- Cache parsed ASTs keyed by `document.version` to avoid re-parsing unchanged documents.
- Offload heavy computation to `Worker` threads or a separate language server process (LSP) for very large files.

---

## References

- [Language Feature Providers](https://code.visualstudio.com/api/language-extensions/overview)
- [vscode.languages API](https://code.visualstudio.com/api/references/vscode-api#languages)
- [Programmatic Language Features](https://code.visualstudio.com/api/language-extensions/programmatic-language-features)
- [Semantic Highlight Guide](https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide)
