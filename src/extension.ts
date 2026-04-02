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
    outputChannel = vscode.window.createOutputChannel('Tlcsdm Git Blame Info');

    const gitContentProvider = new GitContentProvider();

    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider('git-blame-info', gitContentProvider),

        vscode.commands.registerCommand('tlcsdm-gitBlameInfo.showRevisionInformation', () => {
            blameDecorationProvider.activate();
            blameHoverProvider.isActive = true;
            updateContextForActiveEditor();
        }),

        vscode.commands.registerCommand('tlcsdm-gitBlameInfo.hideRevisionInformation', () => {
            blameDecorationProvider.deactivate();
            updateContextForActiveEditor();
            if (!blameDecorationProvider.hasActiveEditors()) {
                blameHoverProvider.isActive = false;
            }
        }),

        vscode.commands.registerCommand('tlcsdm-gitBlameInfo.openCommit', (commitHash: string) => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.uri.scheme === 'file') {
                openCommitDiff(editor.document.uri, commitHash);
            }
        }),

        vscode.commands.registerCommand('tlcsdm-gitBlameInfo.openHistory', () => {
            vscode.commands.executeCommand('timeline.focus');
        }),

        vscode.commands.registerCommand('tlcsdm-gitBlameInfo.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'tlcsdm-gitBlameInfo');
        }),

        vscode.languages.registerHoverProvider({ scheme: 'file' }, blameHoverProvider),

        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('tlcsdm-gitBlameInfo')) {
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
    vscode.commands.executeCommand('setContext', 'tlcsdm-gitBlameInfo.isActive', isActive);
}

function openCommitDiff(fileUri: vscode.Uri, commitHash: string): void {
    const cwd = path.dirname(fileUri.fsPath);
    const fileName = path.basename(fileUri.fsPath);
    const shortHash = commitHash.substring(0, 7);

    // Show the diff between the commit's parent and the commit itself
    const beforeUri = vscode.Uri.from({
        scheme: 'git-blame-info',
        path: fileUri.path,
        query: `${commitHash}~1`
    });
    const afterUri = vscode.Uri.from({
        scheme: 'git-blame-info',
        path: fileUri.path,
        query: commitHash
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
