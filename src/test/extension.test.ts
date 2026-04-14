import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    const extensionId = 'unknowIfGuestInDream.tlcsdm-vscode-git-blame-info';
    const versionAtLeast = (actual: string, minimum: string): boolean => {
        const actualParts = actual.split('.').map((part) => parseInt(part, 10));
        const minimumParts = minimum.split('.').map((part) => parseInt(part, 10));

        for (let i = 0; i < 3; i++) {
            const left = actualParts[i] ?? 0;
            const right = minimumParts[i] ?? 0;
            if (left > right) {
                return true;
            }
            if (left < right) {
                return false;
            }
        }

        return true;
    };

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
        assert.ok(commands.includes('tlcsdm-gitBlameInfo.showRevisionInformation'));
        assert.ok(commands.includes('tlcsdm-gitBlameInfo.hideRevisionInformation'));
        assert.ok(commands.includes('tlcsdm-gitBlameInfo.openCommit'));
        assert.ok(commands.includes('tlcsdm-gitBlameInfo.openHistory'));
        assert.ok(commands.includes('tlcsdm-gitBlameInfo.openSettings'));
        assert.ok(commands.includes('tlcsdm-gitBlameInfo.copyCommitId'));
    });

    test('Configuration defaults should be correct', () => {
        const config = vscode.workspace.getConfiguration('tlcsdm-gitBlameInfo');
        assert.strictEqual(config.get('showAuthor'), true);
        assert.strictEqual(config.get('showDate'), true);
        assert.strictEqual(config.get('showCommitId'), false);
        assert.strictEqual(config.get('showSummary'), true);
        assert.strictEqual(config.get('useRelativeDate'), false);
        assert.strictEqual(config.get('dateFormat'), 'YYYY-MM-DD');
        assert.strictEqual(config.get('columnWidth'), 50);
    });

    test('serialize-javascript should use a patched version', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const serializeJavascriptPackage = require('serialize-javascript/package.json') as { version: string };
        assert.ok(versionAtLeast(serializeJavascriptPackage.version, '7.0.5'));
    });
});
