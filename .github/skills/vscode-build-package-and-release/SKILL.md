---
name: vscode-build-package-and-release
description: Guidance for building, packaging, and releasing VS Code extensions with esbuild, vsce, and GitHub Actions workflows.
---

# Skill: Build, Packaging, and Release

## Overview

This project uses **esbuild** for fast TypeScript bundling and **`@vscode/vsce`** for creating
and publishing `.vsix` packages. GitHub Actions automate the CI, release tagging, and Marketplace
publish workflows.

---

## Build Scripts

```jsonc
// package.json scripts
"vscode:prepublish": "npm run package",
"compile":   "npm run check-types && node esbuild.mjs",
"check-types": "tsc --noEmit",
"watch":     "node esbuild.mjs --watch",
"package":   "npm run check-types && node esbuild.mjs --production",
"pretest":   "tsc -p ./ && npm run lint",
"lint":      "eslint src",
"test":      "vscode-test --config ./.vscode-test.json"
```

| Command | Purpose |
|---|---|
| `npm run compile` | Type-check + bundle (dev, with source maps) |
| `npm run check-types` | Type-check only, no emit |
| `npm run watch` | Incremental rebuild on file change |
| `npm run package` | Production bundle (minified, no source maps) |
| `npm run lint` | ESLint over `src/` |
| `npm run test` | Full test run (requires display) |
| `npx @vscode/vsce package` | Create `.vsix` artifact |

---

## esbuild Configuration (`esbuild.mjs`)

Key settings for VS Code extensions:

```javascript
await esbuild.build({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',            // CommonJS — required by VS Code extension host
    platform: 'node',         // Node.js environment
    external: ['vscode'],     // MUST be external — provided by VS Code at runtime
    outfile: 'dist/extension.js',
    minify: production,       // true for --production flag
    sourcemap: !production,
    sourcesContent: false,    // don't embed source content in maps (reduces size)
    logLevel: 'silent',
});
```

**Important:** `vscode` must always be in `external`. If you add new `external` dependencies,
add them here (e.g., `external: ['vscode', 'electron']`).

For native Node.js modules (e.g., `.node` binaries), also mark them external and
copy them to `dist/` with a post-build script.

---

## `.vscodeignore`

Controls what is excluded from the `.vsix` package. Always exclude:

```
.vscode/**
.github/**
src/**
out/**
node_modules/**
*.map
esbuild.mjs
tsconfig.json
eslint.config.mjs
.vscode-test.json
```

Keep the package small: only ship `dist/`, `syntaxes/`, `images/`, `language-configuration.json`,
`package.json`, `package.nls*.json`, `README.md`, `CHANGELOG.md`, and `LICENSE`.

---

## Versioning

Follow [Semantic Versioning](https://semver.org/):

| Change type | Version bump |
|---|---|
| Bug fixes only | Patch (`1.0.3` → `1.0.4`) |
| New backward-compatible features | Minor (`1.0.3` → `1.1.0`) |
| Breaking changes | Major (`1.0.3` → `2.0.0`) |

Update `version` in `package.json` and add a `CHANGELOG.md` entry before tagging.

---

## GitHub Actions Workflows

### Typical Workflow Structure

```
.github/workflows/
  build.yml          Compile + lint + test on every PR and push
  artifact.yml       Build and upload .vsix artifact
  release.yml        Create GitHub Release on tag push
  publish.yml        Publish to VS Code Marketplace
  sync-gitee.yml     Mirror to Gitee
  sync-vscode-engine.yml  Keep engines.vscode up to date
```

### Example: `build.yml`

```yaml
name: Build

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.x'
          cache: 'npm'
      - run: npm ci
      - run: npm run compile
      - run: npm run lint
      - name: Run tests
        run: xvfb-run -a npm run test
```

### Example: `publish.yml` (Marketplace)

```yaml
name: Publish

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.x'
          cache: 'npm'
      - run: npm ci
      - run: npm run package
      - run: npx @vscode/vsce publish -p ${{ secrets.VSCE_PAT }}
      # Optionally also publish to Open VSX
      - run: npx ovsx publish -p ${{ secrets.OVSX_PAT }}
```

---

## Release Checklist

- [ ] `version` in `package.json` is bumped appropriately.
- [ ] `CHANGELOG.md` has a new entry with date and version.
- [ ] `README.md` is up to date.
- [ ] All locale files (`package.nls*.json`) reflect any new keys.
- [ ] `npm run compile` passes.
- [ ] `npm run lint` passes.
- [ ] Tests pass locally and in CI.
- [ ] `.vsix` package is smoke-tested by installing it in VS Code.
- [ ] GitHub Release created with the tag `v<version>`.
- [ ] Marketplace publish succeeds.

---

## Dependency Management

- Use `npm ci` (not `npm install`) in CI to get reproducible installs from `package-lock.json`.
- The `overrides` field in `package.json` can force transitive dependency versions to address security vulnerabilities.
- Keep `@types/vscode` version aligned with `engines.vscode` minimum version.
- Run `npx @vscode/vsce ls` to see what will be packaged before publishing.

---

## References

- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Bundling Extensions](https://code.visualstudio.com/api/working-with-extensions/bundling-extension)
- [@vscode/vsce](https://github.com/microsoft/vscode-vsce)
- [Continuous Integration](https://code.visualstudio.com/api/working-with-extensions/continuous-integration)
