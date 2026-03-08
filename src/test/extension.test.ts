import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    test('Extension should be present', () => {
        const extension = vscode.extensions.getExtension('unknowIfGuestInDream.vscode-git-blame-info');
        assert.ok(extension);
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('gitBlameInfo.showRevisionInformation'));
        assert.ok(commands.includes('gitBlameInfo.hideRevisionInformation'));
        assert.ok(commands.includes('gitBlameInfo.toggleAuthor'));
        assert.ok(commands.includes('gitBlameInfo.toggleDate'));
        assert.ok(commands.includes('gitBlameInfo.toggleCommitId'));
    });

    test('Configuration defaults should be correct', () => {
        const config = vscode.workspace.getConfiguration('gitBlameInfo');
        assert.strictEqual(config.get('showAuthor'), true);
        assert.strictEqual(config.get('showDate'), true);
        assert.strictEqual(config.get('showCommitId'), false);
        assert.strictEqual(config.get('dateFormat'), 'YYYY-MM-DD');
    });
});
