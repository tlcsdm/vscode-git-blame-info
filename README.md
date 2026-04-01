# Git Blame Info

Display git blame information in the editor gutter with color-coded annotations, inspired by Eclipse EGit.

## Features

- **Show Revision Information**: Right-click the editor line number gutter to toggle git blame annotations
- **Color-coded annotations**: Each commit is displayed with a unique background color for easy identification
- **Configurable display**: Choose to show author, date, and/or commit ID in the gutter
- **Hover details**: Hover over annotated lines to see full commit information
- **Open Commit**: Click "Open Commit" in the hover popup to view commit details
- **Open History**: Click "Open History" in the hover popup to view the file's commit history

## Usage

1. Open a file tracked by Git
2. Right-click in the line number gutter area
3. Select **Show Revision Information**
4. Blame annotations will appear next to each line
5. Hover over any line to see detailed commit information

### Revisions Menu

When revision information is active, a **Revisions** submenu appears in the editor title bar where you can toggle:

- **Author** name display
- **Date** display
- **Commit ID** display

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `tlcsdm-gitBlameInfo.showAuthor` | `true` | Show author name in gutter |
| `tlcsdm-gitBlameInfo.showDate` | `true` | Show commit date in gutter |
| `tlcsdm-gitBlameInfo.showCommitId` | `false` | Show abbreviated commit ID in gutter |
| `tlcsdm-gitBlameInfo.dateFormat` | `YYYY-MM-DD` | Date format for gutter annotation |

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "Git Blame Info"
4. Click Install

### From VSIX File
1. Download the `.vsix` file from [Releases](https://github.com/tlcsdm/vscode-git-blame-info/releases)
2. In VS Code, open Command Palette (`Ctrl+Shift+P`)
3. Search for "Extensions: Install from VSIX..."
4. Select the downloaded `.vsix` file

### From Jenkins
Download from [Jenkins](https://jenkins.tlcsdm.com/job/vscode-plugin/job/vscode-git-blame-info/)

## Build

This project uses TypeScript and npm (Node.js 22).

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode (for development)
npm run watch

# Lint
npm run lint

# Package
npx @vscode/vsce package

# Test
npm run test
```

## Requirements

- Visual Studio Code ^1.85.0
- Git installed and available in PATH

## License

[MIT](LICENSE)
