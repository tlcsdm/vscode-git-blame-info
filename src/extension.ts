import * as vscode from 'vscode';
import * as path from 'path';
import { execFile } from 'child_process';
import { BlameProvider } from './blameProvider';
import { BlameDecorationProvider } from './blameDecorationProvider';
import { BlameHoverProvider } from './blameHoverProvider';
import { GitContentProvider } from './gitContentProvider';

let blameProvider: BlameProvider;
let blameDecorationProvider: BlameDecorationProvider;
let blameHoverProvider: BlameHoverProvider;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext): void {
    blameProvider = new BlameProvider();
    blameDecorationProvider = new BlameDecorationProvider(blameProvider);
    blameHoverProvider = new BlameHoverProvider(blameProvider, blameDecorationProvider);
    outputChannel = vscode.window.createOutputChannel('Git Blame Info');

    const gitContentProvider = new GitContentProvider();

    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider('git-blame-info', gitContentProvider),

        vscode.commands.registerCommand('gitBlameInfo.showRevisionInformation', () => {
            blameDecorationProvider.activate();
            blameHoverProvider.isActive = true;
            updateContextForActiveEditor();
        }),

        vscode.commands.registerCommand('gitBlameInfo.hideRevisionInformation', () => {
            blameDecorationProvider.deactivate();
            updateContextForActiveEditor();
            if (!blameDecorationProvider.hasActiveEditors()) {
                blameHoverProvider.isActive = false;
            }
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
                updateContextForActiveEditor();
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

function updateContextForActiveEditor(): void {
    const editor = vscode.window.activeTextEditor;
    const isActive = editor ? blameDecorationProvider.isActiveForEditor(editor) : false;
    vscode.commands.executeCommand('setContext', 'gitBlameInfo.isActive', isActive);
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

    vscode.commands.executeCommand(
        'vscode.diff',
        beforeUri,
        afterUri,
        `${fileName} (${shortHash})`
    ).then(undefined, () => {
        // Fallback: show commit details in output channel
        showCommitInOutputChannel(cwd, commitHash);
    });
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
