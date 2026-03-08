import * as vscode from 'vscode';
import { BlameProvider } from './blameProvider';
import { BlameDecorationProvider } from './blameDecorationProvider';
import { BlameHoverProvider } from './blameHoverProvider';

let blameProvider: BlameProvider;
let blameDecorationProvider: BlameDecorationProvider;
let blameHoverProvider: BlameHoverProvider;

export function activate(context: vscode.ExtensionContext): void {
    blameProvider = new BlameProvider();
    blameDecorationProvider = new BlameDecorationProvider(blameProvider);
    blameHoverProvider = new BlameHoverProvider(blameProvider);

    context.subscriptions.push(
        vscode.commands.registerCommand('gitBlameInfo.showRevisionInformation', () => {
            vscode.commands.executeCommand('setContext', 'gitBlameInfo.isActive', true);
            blameDecorationProvider.activate();
        }),

        vscode.commands.registerCommand('gitBlameInfo.hideRevisionInformation', () => {
            vscode.commands.executeCommand('setContext', 'gitBlameInfo.isActive', false);
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
        blameDecorationProvider
    );
}

export function deactivate(): void {
    // cleanup handled by disposables
}
