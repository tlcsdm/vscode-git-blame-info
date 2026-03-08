import * as vscode from 'vscode';
import * as path from 'path';
import { execFile } from 'child_process';
import { BlameProvider } from './blameProvider';
import { BlameDecorationProvider } from './blameDecorationProvider';
import { BlameHoverProvider } from './blameHoverProvider';

let blameProvider: BlameProvider;
let blameDecorationProvider: BlameDecorationProvider;
let blameHoverProvider: BlameHoverProvider;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext): void {
    blameProvider = new BlameProvider();
    blameDecorationProvider = new BlameDecorationProvider(blameProvider);
    blameHoverProvider = new BlameHoverProvider(blameProvider);
    outputChannel = vscode.window.createOutputChannel('Git Blame Info');

    context.subscriptions.push(
        vscode.commands.registerCommand('gitBlameInfo.showRevisionInformation', () => {
            vscode.commands.executeCommand('setContext', 'gitBlameInfo.isActive', true);
            blameHoverProvider.isActive = true;
            blameDecorationProvider.activate();
        }),

        vscode.commands.registerCommand('gitBlameInfo.hideRevisionInformation', () => {
            vscode.commands.executeCommand('setContext', 'gitBlameInfo.isActive', false);
            blameHoverProvider.isActive = false;
            blameDecorationProvider.deactivate();
        }),

        vscode.commands.registerCommand('gitBlameInfo.toggleAuthor', () => {
            const config = vscode.workspace.getConfiguration('gitBlameInfo');
            const current = config.get<boolean>('showAuthor', true);
            config.update('showAuthor', !current, vscode.ConfigurationTarget.Global);
        }),

        vscode.commands.registerCommand('gitBlameInfo.toggleDate', () => {
            const config = vscode.workspace.getConfiguration('gitBlameInfo');
            const current = config.get<boolean>('showDate', true);
            config.update('showDate', !current, vscode.ConfigurationTarget.Global);
        }),

        vscode.commands.registerCommand('gitBlameInfo.toggleCommitId', () => {
            const config = vscode.workspace.getConfiguration('gitBlameInfo');
            const current = config.get<boolean>('showCommitId', false);
            config.update('showCommitId', !current, vscode.ConfigurationTarget.Global);
        }),

        vscode.commands.registerCommand('gitBlameInfo.openCommit', (fileUriStr: string, commitHash: string) => {
            openCommitDiff(fileUriStr, commitHash);
        }),

        vscode.commands.registerCommand('gitBlameInfo.openHistory', () => {
            vscode.commands.executeCommand('timeline.focus');
        }),

        vscode.languages.registerHoverProvider({ scheme: 'file' }, blameHoverProvider),

        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('gitBlameInfo')) {
                blameDecorationProvider.refresh();
            }
        }),

        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                blameDecorationProvider.onEditorChanged(editor);
            }
        }),

        vscode.workspace.onDidSaveTextDocument(doc => {
            blameProvider.clearCache(doc.uri);
            blameDecorationProvider.refresh();
        }),

        blameProvider,
        blameDecorationProvider,
        outputChannel
    );
}

function openCommitDiff(fileUriStr: string, commitHash: string): void {
    const fileUri = vscode.Uri.parse(fileUriStr);
    const cwd = path.dirname(fileUri.fsPath);
    const fileName = path.basename(fileUri.fsPath);
    const shortHash = commitHash.substring(0, 7);

    // Show the diff between the commit's parent and the commit itself
    const beforeUri = vscode.Uri.from({
        scheme: 'git-blame-info',
        path: fileUri.fsPath,
        query: JSON.stringify({ commit: `${commitHash}~1`, path: fileUri.fsPath })
    });
    const afterUri = vscode.Uri.from({
        scheme: 'git-blame-info',
        path: fileUri.fsPath,
        query: JSON.stringify({ commit: commitHash, path: fileUri.fsPath })
    });

    // Try to use VS Code's built-in git extension first
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (gitExtension) {
        vscode.commands.executeCommand(
            'vscode.diff',
            beforeUri,
            afterUri,
            `${fileName} (${shortHash})`
        ).then(undefined, () => {
            // Fallback: show commit details in output channel
            showCommitInOutputChannel(cwd, commitHash);
        });
    } else {
        showCommitInOutputChannel(cwd, commitHash);
    }
}

function showCommitInOutputChannel(cwd: string, commitHash: string): void {
    execFile('git', ['show', '--stat', '--format=fuller', commitHash], { cwd }, (error, stdout) => {
        if (error) {
            vscode.window.showErrorMessage(`Failed to show commit ${commitHash.substring(0, 7)}`);
            return;
        }
        outputChannel.clear();
        outputChannel.appendLine(stdout);
        outputChannel.show();
    });
}

export function deactivate(): void {
    // cleanup handled by disposables
}
