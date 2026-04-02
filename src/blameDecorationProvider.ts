import * as vscode from 'vscode';
import { BlameProvider, BlameInfo } from './blameProvider';

export class BlameDecorationProvider implements vscode.Disposable {
    private static readonly DEFAULT_COLUMN_WIDTH = 50;
    private static readonly COLUMN_MARGIN = '0 1.5em 0 0';
    private activeUris = new Set<string>();
    private decorationTypes: vscode.TextEditorDecorationType[] = [];
    private readonly commitColors: string[] = [
        'rgba(255, 235, 59, 0.15)',
        'rgba(129, 199, 132, 0.15)',
        'rgba(100, 181, 246, 0.15)',
        'rgba(239, 154, 154, 0.15)',
        'rgba(206, 147, 216, 0.15)',
        'rgba(255, 183, 77, 0.15)',
        'rgba(128, 222, 234, 0.15)',
        'rgba(255, 138, 128, 0.15)',
        'rgba(197, 225, 165, 0.15)',
        'rgba(179, 157, 219, 0.15)',
        'rgba(255, 213, 79, 0.15)',
        'rgba(144, 202, 249, 0.15)',
    ];

    constructor(private blameProvider: BlameProvider) {}

    dispose(): void {
        this.clearDecorations();
        this.activeUris.clear();
    }

    activate(): void {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.scheme === 'file') {
            this.activeUris.add(editor.document.uri.toString());
            this.applyDecorations(editor);
        }
    }

    deactivate(): void {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            this.activeUris.delete(editor.document.uri.toString());
        }
        this.clearDecorations();
    }

    isActiveForEditor(editor: vscode.TextEditor): boolean {
        return this.activeUris.has(editor.document.uri.toString());
    }

    hasActiveEditors(): boolean {
        return this.activeUris.size > 0;
    }

    onEditorChanged(editor: vscode.TextEditor): void {
        this.clearDecorations();
        if (this.activeUris.has(editor.document.uri.toString())) {
            this.applyDecorations(editor);
        }
    }

    refresh(): void {
        const editor = vscode.window.activeTextEditor;
        if (editor && this.activeUris.has(editor.document.uri.toString())) {
            this.clearDecorations();
            this.applyDecorations(editor);
        }
    }

    private clearDecorations(): void {
        for (const dt of this.decorationTypes) {
            dt.dispose();
        }
        this.decorationTypes = [];
    }

    private async applyDecorations(editor: vscode.TextEditor): Promise<void> {
        this.clearDecorations();

        if (editor.document.uri.scheme !== 'file') {
            return;
        }

        const blameInfo = await this.blameProvider.getBlame(editor.document.uri);
        if (blameInfo.length === 0) {
            return;
        }

        const config = vscode.workspace.getConfiguration('tlcsdm-gitBlameInfo');
        const showAuthor = config.get<boolean>('showAuthor', true);
        const showDate = config.get<boolean>('showDate', true);
        const showCommitId = config.get<boolean>('showCommitId', false);
        const showSummary = config.get<boolean>('showSummary', true);
        const useRelativeDate = config.get<boolean>('useRelativeDate', false);
        const dateFormat = config.get<string>('dateFormat', 'YYYY-MM-DD');
        const columnWidth = config.get<number>('columnWidth', BlameDecorationProvider.DEFAULT_COLUMN_WIDTH);

        // Group lines by commit and assign colors
        const commitColorMap = new Map<string, string>();
        let colorIndex = 0;
        for (const info of blameInfo) {
            if (!commitColorMap.has(info.commit)) {
                commitColorMap.set(info.commit, this.commitColors[colorIndex % this.commitColors.length]);
                colorIndex++;
            }
        }

        // Group blame info by commit for batch decoration
        const commitGroups = new Map<string, BlameInfo[]>();
        for (const info of blameInfo) {
            const group = commitGroups.get(info.commit) || [];
            group.push(info);
            commitGroups.set(info.commit, group);
        }

        for (const [commit, infos] of commitGroups) {
            const backgroundColor = commitColorMap.get(commit) || this.commitColors[0];

            // Build the gutter text from the first line of this commit group
            const sampleInfo = infos[0];
            const gutterText = this.buildGutterText(sampleInfo, showAuthor, showDate, showCommitId, showSummary, useRelativeDate, dateFormat);

            const decorationType = vscode.window.createTextEditorDecorationType({
                backgroundColor,
                isWholeLine: true,
                before: gutterText.length > 0 ? {
                    contentText: gutterText,
                    color: new vscode.ThemeColor('editorLineNumber.foreground'),
                    backgroundColor,
                    fontStyle: 'italic',
                    width: `${columnWidth}ch`,
                    margin: BlameDecorationProvider.COLUMN_MARGIN,
                    textDecoration: 'none; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.85em; border-right: 2px solid rgba(128, 128, 128, 0.3); padding-right: 0.5em;'
                } : undefined,
                overviewRulerColor: backgroundColor,
                overviewRulerLane: vscode.OverviewRulerLane.Left
            });

            const ranges: vscode.DecorationOptions[] = infos.map(info => ({
                range: new vscode.Range(info.lineNumber - 1, 0, info.lineNumber - 1, 0)
            }));

            editor.setDecorations(decorationType, ranges);
            this.decorationTypes.push(decorationType);
        }
    }

    private buildGutterText(
        info: BlameInfo,
        showAuthor: boolean,
        showDate: boolean,
        showCommitId: boolean,
        showSummary: boolean,
        useRelativeDate: boolean,
        dateFormat: string
    ): string {
        const parts: string[] = [];

        if (info.commit.startsWith('0000000')) {
            return 'Uncommitted';
        }

        if (showCommitId) {
            parts.push(info.commit.substring(0, 7));
        }

        if (showSummary) {
            const maxLen = 50;
            const summary = info.summary.length > maxLen
                ? info.summary.substring(0, maxLen) + '…'
                : info.summary;
            parts.push(summary);
        }

        if (showAuthor) {
            parts.push(info.author);
        }

        if (showDate) {
            if (useRelativeDate) {
                parts.push(this.getRelativeDate(info.authorTime));
            } else {
                parts.push(this.formatDate(info.authorTime, dateFormat));
            }
        }

        return parts.join(' · ');
    }

    private getRelativeDate(timestamp: number): string {
        const now = new Date();
        const date = new Date(timestamp * 1000);
        const diffMs = now.getTime() - date.getTime();
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        const diffWeek = Math.floor(diffDay / 7);

        const diffYear = now.getFullYear() - date.getFullYear();
        const diffMonth = diffYear * 12 + (now.getMonth() - date.getMonth());

        if (diffSec < 60) {
            return 'just now';
        } else if (diffMin < 60) {
            return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
        } else if (diffHour < 24) {
            return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
        } else if (diffDay < 7) {
            return diffDay === 1 ? 'yesterday' : `${diffDay} days ago`;
        } else if (diffMonth < 1) {
            return diffWeek === 1 ? '1 week ago' : `${diffWeek} weeks ago`;
        } else if (diffMonth < 12) {
            return diffMonth === 1 ? '1 month ago' : `${diffMonth} months ago`;
        } else {
            return diffYear === 1 ? '1 year ago' : `${diffYear} years ago`;
        }
    }

    private formatDate(timestamp: number, format: string): string {
        const date = new Date(timestamp * 1000);
        const year = date.getFullYear().toString();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');

        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    }
}
