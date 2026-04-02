import * as vscode from 'vscode';
import { execFile } from 'child_process';
import * as path from 'path';

export class GitContentProvider implements vscode.TextDocumentContentProvider {
    provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const commit = uri.query;
        const filePath = uri.fsPath;

        if (!commit || !filePath) {
            return Promise.resolve('');
        }

        const cwd = path.dirname(filePath);

        return new Promise<string>((resolve) => {
            // Get relative path from repo root for git show
            execFile('git', ['rev-parse', '--show-toplevel'], { cwd }, (err, repoRoot) => {
                if (err) {
                    resolve('');
                    return;
                }
                const root = repoRoot.trim();
                const relativePath = path.relative(root, filePath).replace(/\\/g, '/');
                execFile('git', ['show', `${commit}:${relativePath}`], { cwd }, (error, stdout) => {
                    if (error) {
                        // Return empty content if the file didn't exist at that commit
                        resolve('');
                        return;
                    }
                    resolve(stdout);
                });
            });
        });
    }
}
