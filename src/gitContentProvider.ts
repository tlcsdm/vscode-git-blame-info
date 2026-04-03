import * as vscode from 'vscode';
import { execFile } from 'child_process';
import * as path from 'path';

export class GitContentProvider implements vscode.TextDocumentContentProvider {
    provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const commit = uri.query;
        const filePath = uri.fsPath;
        // Use fragment as the relative path from blame data if available.
        // This handles files that were renamed or added — the blame filename
        // is the path relative to repo root at that specific commit.
        const blameRelativePath = uri.fragment || '';

        if (!commit || !filePath) {
            return Promise.resolve('');
        }

        // Special marker: read current working file from disk (read-only virtual copy)
        if (commit === '__WORKING_COPY__') {
            return new Promise<string>((resolve) => {
                vscode.workspace.fs.readFile(vscode.Uri.file(filePath)).then(
                    data => resolve(Buffer.from(data).toString('utf8')),
                    () => resolve('')
                );
            });
        }

        const cwd = path.dirname(filePath);

        return new Promise<string>((resolve) => {
            if (blameRelativePath) {
                // Use blame filename directly (already relative to repo root)
                execFile('git', ['show', `${commit}:${blameRelativePath}`], { cwd }, (error, stdout) => {
                    if (error) {
                        resolve('');
                        return;
                    }
                    resolve(stdout);
                });
            } else {
                // Compute relative path from repo root (fallback)
                execFile('git', ['rev-parse', '--show-toplevel'], { cwd }, (err, repoRoot) => {
                    if (err) {
                        resolve('');
                        return;
                    }
                    const root = repoRoot.trim();
                    const relativePath = path.relative(root, filePath).replace(/\\/g, '/');
                    execFile('git', ['show', `${commit}:${relativePath}`], { cwd }, (error, stdout) => {
                        if (error) {
                            resolve('');
                            return;
                        }
                        resolve(stdout);
                    });
                });
            }
        });
    }
}
