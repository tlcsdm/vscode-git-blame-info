import * as vscode from 'vscode';
import * as path from 'path';
import { execFile } from 'child_process';

interface LogEntry {
    hash: string;
    shortHash: string;
    author: string;
    authorMail: string;
    date: string;
    subject: string;
}

export class GitHistoryProvider {
    private panel: vscode.WebviewPanel | undefined;
    private currentFileUri: vscode.Uri | undefined;

    constructor(
        private readonly openCommitDiff: (fileUri: vscode.Uri, commitHash: string) => void
    ) {}

    async show(fileUri: vscode.Uri, highlightCommit?: string): Promise<void> {
        const cwd = path.dirname(fileUri.fsPath);
        const filePath = fileUri.fsPath;
        const fileName = path.basename(filePath);

        const entries = await this.getGitLog(cwd, filePath);
        if (entries.length === 0) {
            vscode.window.showInformationMessage('No git history found for this file.');
            return;
        }

        this.currentFileUri = fileUri;

        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'gitHistory',
                `History: ${fileName}`,
                vscode.ViewColumn.One,
                { enableScripts: true, retainContextWhenHidden: true }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });

            this.panel.webview.onDidReceiveMessage(message => {
                if (message.command === 'openCommit' && this.currentFileUri) {
                    this.openCommitDiff(this.currentFileUri, message.hash);
                }
            });
        }

        this.panel.title = `History: ${fileName}`;
        this.panel.webview.html = this.getHtml(entries, fileName, highlightCommit);
    }

    private getGitLog(cwd: string, filePath: string): Promise<LogEntry[]> {
        // %x00 as field separator, %x01 as record separator
        const format = '%H%x00%h%x00%an%x00%ae%x00%ai%x00%s%x01';
        return new Promise<LogEntry[]>((resolve) => {
            execFile(
                'git',
                ['log', '--follow', `--format=${format}`, '--', filePath],
                { cwd, maxBuffer: 10 * 1024 * 1024 },
                (error, stdout) => {
                    if (error || !stdout.trim()) {
                        resolve([]);
                        return;
                    }

                    const records = stdout.split('\x01').filter(r => r.trim());
                    const entries: LogEntry[] = [];
                    for (const record of records) {
                        const fields = record.trim().split('\x00');
                        if (fields.length >= 6) {
                            entries.push({
                                hash: fields[0],
                                shortHash: fields[1],
                                author: fields[2],
                                authorMail: fields[3],
                                date: fields[4],
                                subject: fields[5],
                            });
                        }
                    }
                    resolve(entries);
                }
            );
        });
    }

    private getHtml(entries: LogEntry[], fileName: string, highlightCommit?: string): string {
        const rows = entries.map(entry => {
            const isHighlighted = highlightCommit ? entry.hash === highlightCommit : false;
            const escapedSubject = this.escapeHtml(entry.subject);
            const escapedAuthor = this.escapeHtml(entry.author);
            const date = entry.date.substring(0, 10);
            return `<tr class="commit-row${isHighlighted ? ' highlighted' : ''}"
                        data-hash="${entry.hash}"
                        ${isHighlighted ? 'id="highlighted-row"' : ''}>
                <td class="col-hash">${entry.shortHash}</td>
                <td class="col-date">${date}</td>
                <td class="col-author">${escapedAuthor}</td>
                <td class="col-subject">${escapedSubject}</td>
            </tr>`;
        }).join('\n');

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
    body {
        font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
        font-size: var(--vscode-font-size, 13px);
        color: var(--vscode-foreground);
        background: var(--vscode-editor-background);
        margin: 0;
        padding: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        height: 100vh;
    }
    .header {
        padding: 8px 16px;
        font-weight: 600;
        font-size: 1.1em;
        border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.35));
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .header .file-icon {
        opacity: 0.7;
    }
    .table-container {
        flex: 1;
        overflow: auto;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
    }
    thead th {
        position: sticky;
        top: 0;
        background: var(--vscode-editor-background);
        border-bottom: 2px solid var(--vscode-panel-border, rgba(128,128,128,0.35));
        text-align: left;
        padding: 6px 10px;
        font-weight: 600;
        font-size: 0.85em;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--vscode-descriptionForeground, rgba(128,128,128,0.85));
        z-index: 1;
    }
    td {
        padding: 5px 10px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.12));
    }
    .col-hash { width: 80px; font-family: var(--vscode-editor-font-family, monospace); color: var(--vscode-textLink-foreground, #3794ff); }
    .col-date { width: 100px; }
    .col-author { width: 160px; }
    .col-subject { width: auto; }
    .commit-row {
        cursor: pointer;
    }
    .commit-row:hover {
        background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.1));
    }
    .commit-row.highlighted {
        background: var(--vscode-list-activeSelectionBackground, rgba(0,120,212,0.3));
        color: var(--vscode-list-activeSelectionForeground, inherit);
    }
    .commit-row.highlighted:hover {
        background: var(--vscode-list-activeSelectionBackground, rgba(0,120,212,0.4));
    }
    .commit-row.selected {
        outline: 1px solid var(--vscode-focusBorder, rgba(0,120,212,0.8));
        outline-offset: -1px;
    }
    .badge {
        display: inline-block;
        background: var(--vscode-badge-background, #4d4d4d);
        color: var(--vscode-badge-foreground, #fff);
        padding: 1px 6px;
        border-radius: 10px;
        font-size: 0.8em;
        margin-left: 8px;
    }
</style>
</head>
<body>
    <div class="header">
        <span class="file-icon">&#128196;</span>
        <span>${this.escapeHtml(fileName)}</span>
        <span class="badge">${entries.length} commits</span>
    </div>
    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th class="col-hash">Commit</th>
                    <th class="col-date">Date</th>
                    <th class="col-author">Author</th>
                    <th class="col-subject">Message</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let selectedRow = null;

        document.querySelectorAll('.commit-row').forEach(row => {
            row.addEventListener('click', () => {
                if (selectedRow) {
                    selectedRow.classList.remove('selected');
                }
                row.classList.add('selected');
                selectedRow = row;
                vscode.postMessage({ command: 'openCommit', hash: row.dataset.hash });
            });
        });

        // Scroll to highlighted commit
        const highlighted = document.getElementById('highlighted-row');
        if (highlighted) {
            highlighted.scrollIntoView({ block: 'center', behavior: 'auto' });
        }
    </script>
</body>
</html>`;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
