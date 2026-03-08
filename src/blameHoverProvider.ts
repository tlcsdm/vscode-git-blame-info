import * as vscode from 'vscode';
import { BlameProvider } from './blameProvider';

export class BlameHoverProvider implements vscode.HoverProvider {
    constructor(private blameProvider: BlameProvider) {}

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Hover | undefined> {
        // Only show hover when blame is active
        const isActive = await vscode.commands.executeCommand<boolean>('getContext', 'gitBlameInfo.isActive');
        // If context is not set, use a fallback check
        if (isActive === false) {
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

        // Open Commit command - uses the built-in Git extension's show commit command
        const openCommitArgs = encodeURIComponent(JSON.stringify([blameInfo.commit]));
        markdown.appendMarkdown(
            `[$(git-commit) Open Commit](command:git.viewCommit?${openCommitArgs} "View this commit")`
        );
        markdown.appendMarkdown('&nbsp;&nbsp;&nbsp;');

        // Open History command - uses the built-in timeline view
        const fileUri = document.uri.toString();
        const openHistoryArgs = encodeURIComponent(JSON.stringify([fileUri]));
        markdown.appendMarkdown(
            `[$(history) Open History](command:timeline.focus?${openHistoryArgs} "View file history")`
        );

        return new vscode.Hover(markdown, new vscode.Range(position.line, 0, position.line, 0));
    }
}

function escapeMarkdown(text: string): string {
    return text.replace(/[\\`*_{}[\]()#+\-.!|]/g, '\\$&');
}
