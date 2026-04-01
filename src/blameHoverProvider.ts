import * as vscode from 'vscode';
import { BlameProvider } from './blameProvider';
import { BlameDecorationProvider } from './blameDecorationProvider';

export class BlameHoverProvider implements vscode.HoverProvider {
    private _isActive = false;

    constructor(
        private blameProvider: BlameProvider,
        private blameDecorationProvider: BlameDecorationProvider
    ) {}

    set isActive(value: boolean) {
        this._isActive = value;
    }

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Hover | undefined> {
        if (!this._isActive) {
            return undefined;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor || !this.blameDecorationProvider.isActiveForEditor(editor)) {
            return undefined;
        }

        const blameInfo = await this.blameProvider.getBlameForLine(document.uri, position.line + 1);
        if (!blameInfo || blameInfo.commit.startsWith('0000000')) {
            return undefined;
        }

        const date = new Date(blameInfo.authorTime * 1000);
        const dateStr = date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const markdown = new vscode.MarkdownString('', true);
        markdown.isTrusted = true;
        markdown.supportHtml = true;

        markdown.appendMarkdown(`### $(git-commit) ${escapeMarkdown(blameInfo.summary)}\n\n`);
        markdown.appendMarkdown(`**$(person)** ${escapeMarkdown(blameInfo.author)} ${escapeMarkdown(blameInfo.authorMail)}\n\n`);
        markdown.appendMarkdown(`**$(calendar)** ${escapeMarkdown(dateStr)}\n\n`);
        markdown.appendMarkdown(`**Commit:** \`${blameInfo.commit.substring(0, 7)}\`\n\n`);
        markdown.appendMarkdown('---\n\n');

        // Open Commit - uses our registered command to show the commit diff
        const openCommitArgs = encodeURIComponent(JSON.stringify([document.uri.toString(), blameInfo.commit]));
        markdown.appendMarkdown(
            `[$(git-commit) Open Commit](command:tlcsdm-gitBlameInfo.openCommit?${openCommitArgs} "View this commit")`
        );
        markdown.appendMarkdown('&nbsp;&nbsp;&nbsp;');

        // Open History - focuses the built-in timeline view
        markdown.appendMarkdown(
            `[$(history) Open History](command:tlcsdm-gitBlameInfo.openHistory "View file history")`
        );
        markdown.appendMarkdown('&nbsp;&nbsp;&nbsp;');

        // Open Settings - opens extension settings
        markdown.appendMarkdown(
            `[$(gear) Settings](command:tlcsdm-gitBlameInfo.openSettings "Open extension settings")`
        );

        return new vscode.Hover(markdown, new vscode.Range(position.line, 0, position.line, 0));
    }
}

function escapeMarkdown(text: string): string {
    return text.replace(/[\\`*_{}[\]()#+\-.!|]/g, '\\$&');
}
