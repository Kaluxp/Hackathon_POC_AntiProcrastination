import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	test('Registers Top Chrono commands', async () => {
		await vscode.commands.executeCommand('topChrono.start');

		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('topChrono.start'));
		assert.ok(commands.includes('topChrono.exportGithubBadge'));
	});
});
