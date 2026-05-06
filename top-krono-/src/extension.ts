import * as vscode from 'vscode';
import { buildGithubSummary } from './topChrono/github';
import { TopChronoSession } from './topChrono/session';
import { renderStatusBar } from './topChrono/statusBar';

let session: TopChronoSession | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;

export function activate(context: vscode.ExtensionContext): void {
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	context.subscriptions.push(statusBarItem);
	session = new TopChronoSession(context, () => {
		if (statusBarItem && session) {
			renderStatusBar(statusBarItem, session.getState());
		}
	});
	renderStatusBar(statusBarItem, session.getState());

	const startCommand = vscode.commands.registerCommand('top-krono.start', () => {
		if (!session) {
			return;
		}

		const started = session.start();
		if (started) {
			vscode.window.showInformationMessage('Top Chrono started. Stay focused.');
			return;
		}

		vscode.window.showInformationMessage('Top Chrono is already running.');
	});

	const exportGithubCommand = vscode.commands.registerCommand('top-krono.exportGithubBadge', async () => {
		if (!session) {
			return;
		}

		const markdown = buildGithubSummary(context, session.getState());
		await vscode.env.clipboard.writeText(markdown);
		vscode.window.showInformationMessage('Top Chrono summary copied to clipboard for GitHub.');
	});

	const textChangeListener = vscode.workspace.onDidChangeTextDocument(() => {
		session?.addActivityPoints(2);
	});
	const editorChangeListener = vscode.window.onDidChangeActiveTextEditor(() => {
		session?.addActivityPoints(1);
	});
	const saveListener = vscode.workspace.onDidSaveTextDocument(() => {
		session?.addActivityPoints(3);
	});

	context.subscriptions.push(
		startCommand,
		exportGithubCommand,
		textChangeListener,
		editorChangeListener,
		saveListener,
		new vscode.Disposable(async () => {
			await session?.dispose();
		})
	);
}

export function deactivate(): void {
	void session?.dispose();
}
