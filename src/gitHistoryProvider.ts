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
    filename: string;
}

export class GitHistoryProvider {
    private panel: vscode.WebviewPanel | undefined;
    private currentFileUri: vscode.Uri | undefined;

    constructor(
        private readonly callbacks: {
            openFileCommitDiff: (fileUri: vscode.Uri, commitHash: string, prevCommitHash: string | null, filename: string, prevFilename: string) => void;
            copyCommitId: (commitHash: string) => void;
            compareWithCurrent: (fileUri: vscode.Uri, commitHash: string, filename: string) => void;
        }
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
            this.panel.title = `History: ${fileName}`;
            this.panel.webview.html = this.getHtml(entries, fileName, highlightCommit);
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
                if (!this.currentFileUri) { return; }
                switch (message.command) {
                    case 'openCommit':
                        this.callbacks.openFileCommitDiff(
                            this.currentFileUri,
                            message.hash,
                            message.prevHash || null,
                            message.filename || '',
                            message.prevFilename || ''
                        );
                        break;
                    case 'copyCommitId':
                        this.callbacks.copyCommitId(message.hash);
                        break;
                    case 'compareWithCurrent':
                        this.callbacks.compareWithCurrent(
                            this.currentFileUri,
                            message.hash,
                            message.filename || ''
                        );
                        break;
                }
            });

            this.panel.webview.html = this.getHtml(entries, fileName, highlightCommit);
        }
    }

    private getGitLog(cwd: string, filePath: string): Promise<LogEntry[]> {
        const format = '%x01%H%x00%h%x00%an%x00%ae%x00%ai%x00%s';
        return new Promise<LogEntry[]>((resolve) => {
            execFile(
                'git',
                ['log', '--follow', `--format=${format}`, '--name-only', '--', filePath],
                { cwd, maxBuffer: 10 * 1024 * 1024 },
                (error, stdout) => {
                    if (error || !stdout.trim()) {
                        resolve([]);
                        return;
                    }

                    const records = stdout.split('\x01').filter(r => r.trim());
                    const entries: LogEntry[] = [];
                    for (const record of records) {
                        const lines = record.split('\n');
                        const fields = lines[0].split('\x00');
                        if (fields.length >= 6) {
                            // filename follows after blank line from --name-only
                            let filename = '';
                            for (let i = 1; i < lines.length; i++) {
                                const trimmed = lines[i].trim();
                                if (trimmed) {
                                    filename = trimmed;
                                    break;
                                }
                            }
                            entries.push({
                                hash: fields[0],
                                shortHash: fields[1],
                                author: fields[2],
                                authorMail: fields[3],
                                date: fields[4],
                                subject: fields[5],
                                filename,
                            });
                        }
                    }
                    resolve(entries);
                }
            );
        });
    }

    private getHtml(entries: LogEntry[], fileName: string, highlightCommit?: string): string {
        // Safely embed entries JSON for webview JS (prevent </script> injection)
        const entriesJson = JSON.stringify(entries).replace(/</g, '\\u003c');

        const rows = entries.map((entry, index) => {
            const isHighlighted = highlightCommit ? entry.hash === highlightCommit : false;
            const escapedSubject = this.escapeHtml(entry.subject);
            const escapedAuthor = this.escapeHtml(entry.author);
            const date = entry.date.substring(0, 10);
            return `<tr class="commit-row${isHighlighted ? ' highlighted' : ''}"
                        data-hash="${entry.hash}"
                        data-index="${index}"
                        ${isHighlighted ? 'id="highlighted-row"' : ''}>
                <td class="col-hash"><a class="hash-link" data-hash="${entry.hash}" title="View diff with previous commit">${entry.shortHash}</a></td>
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
    .header .file-icon { opacity: 0.7; }
    .badge {
        display: inline-block;
        background: var(--vscode-badge-background, #4d4d4d);
        color: var(--vscode-badge-foreground, #fff);
        padding: 1px 6px;
        border-radius: 10px;
        font-size: 0.8em;
        margin-left: 8px;
    }
    .main-content {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow: hidden;
    }
    .table-container {
        flex: 1;
        overflow: auto;
        min-height: 0;
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
    .col-hash {
        width: 80px;
        font-family: var(--vscode-editor-font-family, monospace);
    }
    .col-date { width: 100px; }
    .col-author { width: 160px; }
    .col-subject { width: auto; }
    .hash-link {
        color: var(--vscode-textLink-foreground, #3794ff);
        cursor: pointer;
        text-decoration: none;
    }
    .hash-link:hover { text-decoration: underline; }
    .commit-row { cursor: default; }
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
    /* Detail panel */
    .detail-panel {
        border-top: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.35));
        flex-shrink: 0;
    }
    .detail-header {
        padding: 6px 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        font-size: 0.9em;
        color: var(--vscode-descriptionForeground, rgba(128,128,128,0.85));
        user-select: none;
        border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.12));
    }
    .detail-header:hover {
        background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.1));
    }
    .detail-content {
        max-height: 130px;
        overflow: auto;
        padding: 8px 16px;
    }
    .detail-row {
        padding: 3px 0;
        display: flex;
        gap: 8px;
    }
    .detail-label {
        color: var(--vscode-descriptionForeground, rgba(128,128,128,0.85));
        font-weight: 600;
        white-space: nowrap;
        min-width: 65px;
    }
    .detail-value { word-break: break-all; }
    .detail-value.monospace {
        font-family: var(--vscode-editor-font-family, monospace);
    }
    .detail-placeholder {
        color: var(--vscode-descriptionForeground, rgba(128,128,128,0.5));
        font-style: italic;
        padding: 8px 0;
    }
    /* Context menu */
    .context-menu {
        display: none;
        position: fixed;
        z-index: 100;
        background: var(--vscode-menu-background, #252526);
        border: 1px solid var(--vscode-menu-border, rgba(128,128,128,0.35));
        border-radius: 4px;
        padding: 4px 0;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        min-width: 200px;
    }
    .context-menu-item {
        padding: 6px 20px;
        cursor: pointer;
        color: var(--vscode-menu-foreground, #ccc);
        white-space: nowrap;
    }
    .context-menu-item:hover {
        background: var(--vscode-menu-selectionBackground, #094771);
        color: var(--vscode-menu-selectionForeground, #fff);
    }
</style>
</head>
<body>
    <div class="header">
        <span class="file-icon">&#128196;</span>
        <span>${this.escapeHtml(fileName)}</span>
        <span class="badge">${entries.length} commits</span>
    </div>
    <div class="main-content">
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
        <div class="detail-panel" id="detail-panel">
            <div class="detail-header" id="toggle-detail">
                <span id="toggle-icon">&#9662;</span>
                <span>Commit Details</span>
            </div>
            <div class="detail-content" id="detail-content">
                <div class="detail-placeholder">Select a commit to view details</div>
            </div>
        </div>
    </div>
    <div id="context-menu" class="context-menu">
        <div id="ctx-copy" class="context-menu-item">Copy Commit ID</div>
        <div id="ctx-compare" class="context-menu-item">Compare with Current File</div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const entries = ${entriesJson};
        let selectedRow = null;
        let contextMenuHash = null;
        let detailVisible = true;

        const entryByHash = Object.create(null);
        entries.forEach(function(entry, index) {
            entryByHash[entry.hash] = { entry, index };
        });

        // Click hash link -> open diff with previous file commit
        document.querySelectorAll('.hash-link').forEach(function(link) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const hash = link.dataset.hash;
                const info = entryByHash[hash];
                if (!info) return;
                const prevEntry = info.index < entries.length - 1 ? entries[info.index + 1] : null;
                vscode.postMessage({
                    command: 'openCommit',
                    hash: info.entry.hash,
                    prevHash: prevEntry ? prevEntry.hash : null,
                    filename: info.entry.filename,
                    prevFilename: prevEntry ? prevEntry.filename : ''
                });
            });
        });

        // Click row -> select and show details in bottom panel
        document.querySelectorAll('.commit-row').forEach(function(row) {
            row.addEventListener('click', function() {
                selectRow(row);
            });
        });

        function selectRow(row) {
            if (selectedRow) selectedRow.classList.remove('selected');
            row.classList.add('selected');
            selectedRow = row;
            const hash = row.dataset.hash;
            const info = entryByHash[hash];
            if (info) showDetails(info.entry);
        }

        // Right-click -> context menu
        document.querySelectorAll('.commit-row').forEach(function(row) {
            row.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                contextMenuHash = row.dataset.hash;
                selectRow(row);
                const menu = document.getElementById('context-menu');
                menu.style.left = e.pageX + 'px';
                menu.style.top = e.pageY + 'px';
                menu.style.display = 'block';
            });
        });

        document.getElementById('ctx-copy').addEventListener('click', function() {
            if (contextMenuHash) {
                vscode.postMessage({ command: 'copyCommitId', hash: contextMenuHash });
            }
            hideContextMenu();
        });

        document.getElementById('ctx-compare').addEventListener('click', function() {
            if (contextMenuHash) {
                const info = entryByHash[contextMenuHash];
                vscode.postMessage({
                    command: 'compareWithCurrent',
                    hash: contextMenuHash,
                    filename: info ? info.entry.filename : ''
                });
            }
            hideContextMenu();
        });

        document.addEventListener('click', function(e) {
            if (!e.target.closest('.context-menu')) {
                hideContextMenu();
            }
        });

        function hideContextMenu() {
            document.getElementById('context-menu').style.display = 'none';
        }

        function showDetails(entry) {
            var content = document.getElementById('detail-content');
            content.innerHTML =
                '<div class="detail-row"><span class="detail-label">Commit:</span> <span class="detail-value monospace">' + escapeHtml(entry.hash) + '</span></div>' +
                '<div class="detail-row"><span class="detail-label">Author:</span> <span class="detail-value">' + escapeHtml(entry.author) + ' ' + escapeHtml(entry.authorMail) + '</span></div>' +
                '<div class="detail-row"><span class="detail-label">Date:</span> <span class="detail-value">' + escapeHtml(entry.date) + '</span></div>' +
                '<div class="detail-row"><span class="detail-label">Message:</span> <span class="detail-value">' + escapeHtml(entry.subject) + '</span></div>';
        }

        function escapeHtml(text) {
            var div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Toggle detail panel
        document.getElementById('toggle-detail').addEventListener('click', function() {
            detailVisible = !detailVisible;
            var content = document.getElementById('detail-content');
            var icon = document.getElementById('toggle-icon');
            content.style.display = detailVisible ? 'block' : 'none';
            icon.innerHTML = detailVisible ? '&#9662;' : '&#9656;';
        });

        // Scroll to highlighted commit and auto-select
        var highlighted = document.getElementById('highlighted-row');
        if (highlighted) {
            highlighted.scrollIntoView({ block: 'center', behavior: 'auto' });
            selectRow(highlighted);
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
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}
