import * as vscode from 'vscode';
import { execFile } from 'child_process';
import * as path from 'path';

export interface BlameInfo {
    commit: string;
    author: string;
    authorMail: string;
    authorTime: number;
    authorTz: string;
    summary: string;
    filename: string;
    lineNumber: number;
}

export class BlameProvider implements vscode.Disposable {
    private cache = new Map<string, BlameInfo[]>();

    dispose(): void {
        this.cache.clear();
    }

    clearCache(uri?: vscode.Uri): void {
        if (uri) {
            this.cache.delete(uri.fsPath);
        } else {
            this.cache.clear();
        }
    }

    async getBlame(uri: vscode.Uri): Promise<BlameInfo[]> {
        const cached = this.cache.get(uri.fsPath);
        if (cached) {
            return cached;
        }

        const blameInfo = await this.executeGitBlame(uri);
        if (blameInfo.length > 0) {
            this.cache.set(uri.fsPath, blameInfo);
        }
        return blameInfo;
    }

    async getBlameForLine(uri: vscode.Uri, line: number): Promise<BlameInfo | undefined> {
        const blameInfo = await this.getBlame(uri);
        return blameInfo.find(b => b.lineNumber === line);
    }

    private executeGitBlame(uri: vscode.Uri): Promise<BlameInfo[]> {
        return new Promise((resolve) => {
            const cwd = path.dirname(uri.fsPath);
            const filePath = uri.fsPath;

            execFile('git', ['blame', '--porcelain', filePath], { cwd }, (error, stdout) => {
                if (error) {
                    resolve([]);
                    return;
                }

                try {
                    const result = this.parsePorcelainBlame(stdout);
                    resolve(result);
                } catch {
                    resolve([]);
                }
            });
        });
    }

    private parsePorcelainBlame(output: string): BlameInfo[] {
        const lines = output.split('\n');
        const result: BlameInfo[] = [];
        let currentCommit = '';
        let currentAuthor = '';
        let currentAuthorMail = '';
        let currentAuthorTime = 0;
        let currentAuthorTz = '';
        let currentSummary = '';
        let currentLineNumber = 0;

        for (const line of lines) {
            // Commit line: <hash> <orig-line> <final-line> [<num-lines>]
            const commitMatch = line.match(/^([0-9a-f]{40})\s+(\d+)\s+(\d+)/);
            if (commitMatch) {
                currentCommit = commitMatch[1];
                currentLineNumber = parseInt(commitMatch[3], 10);
                continue;
            }

            if (line.startsWith('author ')) {
                currentAuthor = line.substring(7);
            } else if (line.startsWith('author-mail ')) {
                currentAuthorMail = line.substring(12);
            } else if (line.startsWith('author-time ')) {
                currentAuthorTime = parseInt(line.substring(12), 10);
            } else if (line.startsWith('author-tz ')) {
                currentAuthorTz = line.substring(10);
            } else if (line.startsWith('summary ')) {
                currentSummary = line.substring(8);
            } else if (line.startsWith('filename ')) {
                // filename is the last header before the content line
                result.push({
                    commit: currentCommit,
                    author: currentAuthor,
                    authorMail: currentAuthorMail,
                    authorTime: currentAuthorTime,
                    authorTz: currentAuthorTz,
                    summary: currentSummary,
                    filename: line.substring(9),
                    lineNumber: currentLineNumber
                });
            }
        }

        return result;
    }
}
