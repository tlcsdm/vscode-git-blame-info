import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    const extensionId = 'unknowIfGuestInDream.vscode-git-blame-info';

    suiteSetup(async () => {
        const extension = vscode.extensions.getExtension(extensionId);
        if (extension && !extension.isActive) {
            await extension.activate();
        }
    });

    test('Extension should be present', () => {
        const extension = vscode.extensions.getExtension(extensionId);
        assert.ok(extension);
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('gitBlameInfo.showRevisionInformation'));
        assert.ok(commands.includes('gitBlameInfo.hideRevisionInformation'));
        assert.ok(commands.includes('gitBlameInfo.toggleAuthor'));
        assert.ok(commands.includes('gitBlameInfo.toggleDate'));
        assert.ok(commands.includes('gitBlameInfo.toggleCommitId'));
        assert.ok(commands.includes('gitBlameInfo.openCommit'));
        assert.ok(commands.includes('gitBlameInfo.openHistory'));
    });

    test('Configuration defaults should be correct', () => {
        const config = vscode.workspace.getConfiguration('gitBlameInfo');
        assert.strictEqual(config.get('showAuthor'), true);
        assert.strictEqual(config.get('showDate'), true);
        assert.strictEqual(config.get('showCommitId'), false);
        assert.strictEqual(config.get('dateFormat'), 'YYYY-MM-DD');
    });
});
