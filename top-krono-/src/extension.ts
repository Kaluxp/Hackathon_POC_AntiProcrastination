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

	const dashboardCommand = vscode.commands.registerCommand('top-krono.openDashboard', () => {
		const panel = vscode.window.createWebviewPanel(
			'topChrono',
			'Top Chrono',
			vscode.ViewColumn.One,
			{
				enableScripts: true
			}
		);

		panel.webview.html = getWebviewContent();
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
		dashboardCommand,
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

function getWebviewContent(): string {
	return `
	<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Top Chrono</title>
		<style>
			body {
				background-color: #0f172a;
				color: white;
				font-family: Arial, sans-serif;
				padding: 20px;
			}

			.card {
				background: #1e293b;
				border-radius: 12px;
				padding: 20px;
				box-shadow: 0 4px 20px rgba(0,0,0,0.5);
			}

			.progress {
				height: 10px;
				background: #334155;
				border-radius: 5px;
				overflow: hidden;
				margin-top: 10px;
			}

			.progress-bar {
				height: 100%;
				width: 65%;
				background: linear-gradient(90deg, #7c3aed, #a78bfa);
			}

			button {
				margin-top: 15px;
				padding: 10px;
				border: none;
				border-radius: 8px;
				background: #7c3aed;
				color: white;
				cursor: pointer;
			}
		</style>
	</head>
	<body>
		<div class="card">
			<h2>⚡ Top Chrono</h2>
			<p>Rank: Chevalier Jedi</p>
			
			<div class="progress">
				<div class="progress-bar"></div>
			</div>

			<button onclick="alert('Start!')">Start Session</button>
		</div>
	</body>
	</html>
	`;
}