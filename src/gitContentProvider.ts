import * as vscode from 'vscode';
import { execFile } from 'child_process';
import * as path from 'path';

export class GitContentProvider implements vscode.TextDocumentContentProvider {
    provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const params = JSON.parse(uri.query);
        const commit: string = params.commit;
        const filePath: string = params.path;
        const cwd = path.dirname(filePath);

        return new Promise<string>((resolve, reject) => {
            // Get relative path from repo root for git show
            execFile('git', ['rev-parse', '--show-toplevel'], { cwd }, (err, repoRoot) => {
                if (err) {
                    reject(err);
                    return;
                }
                const root = repoRoot.trim();
                const relativePath = path.relative(root, filePath);
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
