import * as vscode from 'vscode';
import { formatLongDuration } from './topChrono/format';
import { buildGithubSummary } from './topChrono/github';
import { getCurrentRank, getNextRank, RANKS } from './topChrono/ranks';
import { TopChronoSession } from './topChrono/session';
import { renderStatusBar } from './topChrono/statusBar';

let session: TopChronoSession | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let dashboardPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext): void {
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.command = 'top-krono.openDashboard';
	context.subscriptions.push(statusBarItem);

	session = new TopChronoSession(context, () => {
		if (statusBarItem && session) {
			renderStatusBar(statusBarItem, session.getState());
			pushDashboardState(context);
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
		if (dashboardPanel) {
			dashboardPanel.reveal(vscode.ViewColumn.One);
			pushDashboardState(context);
			return;
		}

		dashboardPanel = vscode.window.createWebviewPanel('topChrono', 'Top Chrono Dashboard', vscode.ViewColumn.One, {
			enableScripts: true,
		});
		dashboardPanel.webview.html = getWebviewContent();

		dashboardPanel.webview.onDidReceiveMessage(async (message) => {
			if (!session) {
				return;
			}

			switch (message?.type) {
				case 'requestState':
					pushDashboardState(context);
					break;
				case 'start':
					if (session.start()) {
						vscode.window.showInformationMessage('Top Chrono started. Stay focused.');
					}
					pushDashboardState(context);
					break;
				case 'copyGithub':
					await vscode.commands.executeCommand('top-krono.exportGithubBadge');
					pushDashboardState(context);
					break;
				default:
					break;
			}
		});

		dashboardPanel.onDidDispose(() => {
			dashboardPanel = undefined;
		});

		pushDashboardState(context);
	});

	const exportGithubCommand = vscode.commands.registerCommand('top-krono.exportGithubBadge', async () => {
		if (!session) {
			return;
		}

		const markdown = buildGithubSummary(context, session.getState());
		await vscode.env.clipboard.writeText(markdown);
		vscode.window.showInformationMessage('Top Chrono summary copied to clipboard for GitHub.');
	});

	const textChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
		const typedChars = event.contentChanges.reduce((acc, change) => acc + change.text.length, 0);
		const pointsFromChars = Math.max(1, Math.ceil(typedChars / 2));
		session?.addActivityPoints(pointsFromChars);
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
		<title>Top Chrono Dashboard</title>
		<style>
			body {
				background: #0b1220;
				color: #e5e7eb;
				font-family: Inter, Segoe UI, Arial, sans-serif;
				padding: 20px 24px;
			}

			.wrap {
				max-width: 780px;
				margin: 0 auto;
			}

			.card, .kpi {
				background: #111827;
				border-radius: 12px;
				padding: 16px;
				border: 1px solid #374151;
			}

			h1 {
				margin: 0 0 6px 0;
				font-size: 22px;
			}

			.muted {
				color: #9ca3af;
				margin-bottom: 16px;
			}

			.row {
				display: grid;
				grid-template-columns: repeat(3, minmax(0, 1fr));
				gap: 12px;
				margin-bottom: 14px;
			}

			.kpi .label {
				color: #93c5fd;
				font-size: 12px;
			}

			.kpi .value {
				font-size: 18px;
				font-weight: 700;
				margin-top: 6px;
			}

			.progress {
				height: 100%;
				width: 0%;
				background: linear-gradient(90deg, #7c3aed, #22d3ee);
				border-radius: 999px;
				transition: width 0.3s;
			}

			.progressTrack {
				margin-top: 10px;
				height: 10px;
				background: #1f2937;
				border-radius: 999px;
				overflow: hidden;
			}

			.pill {
				display: inline-block;
				margin-top: 10px;
				padding: 6px 10px;
				border-radius: 999px;
				font-size: 12px;
				background: #1f2937;
				color: #d1d5db;
			}

			.actions {
				display: flex;
				gap: 10px;
				margin-top: 14px;
			}

			button {
				padding: 9px 12px;
				border: none;
				border-radius: 8px;
				background: #7c3aed;
				color: #fff;
				cursor: pointer;
			}

			button.secondary {
				background: #374151;
			}

			ul {
				padding-left: 18px;
				color: #d1d5db;
			}
		</style>
	</head>
	<body>
		<div class="wrap">
			<h1>Top Chrono Dashboard</h1>
			<div class="muted">Focus discipline with game-like progression.</div>

			<div class="row">
				<div class="kpi"><div class="label">Work time</div><div id="work" class="value">00:00</div></div>
				<div class="kpi"><div class="label">Break earned</div><div id="break" class="value">00:00</div></div>
				<div class="kpi"><div class="label">Current rank</div><div id="rank" class="value">Novice</div></div>
			</div>

			<div class="card">
				<div style="font-weight:600">Rank progress</div>
				<div id="nextRank" class="pill">No next rank</div>
				<div class="progressTrack">
					<div id="rankProgress" class="progress"></div>
				</div>
			</div>

			<div class="card" style="margin-top:12px">
				<div style="font-weight:600">Pause system</div>
				<ul>
					<li id="autoBreak">Auto break: every minute gain +10s</li>
					<li id="activityProgress">Activity points: 0 / 10</li>
				</ul>
				<div class="actions">
					<button id="startBtn">Start Top Chrono</button>
					<button id="copyBtn" class="secondary">Copy GitHub Summary</button>
				</div>
			</div>
		</div>

		<script>
			const vscode = acquireVsCodeApi();
			const el = (id) => document.getElementById(id);

			el('startBtn').addEventListener('click', () => vscode.postMessage({ type: 'start' }));
			el('copyBtn').addEventListener('click', () => vscode.postMessage({ type: 'copyGithub' }));

			window.addEventListener('message', (event) => {
				const data = event.data;
				if (!data || data.type !== 'state') {
					return;
				}

				el('work').textContent = data.work;
				el('break').textContent = data.break;
				el('rank').textContent = data.rank;
				el('nextRank').textContent = data.nextRankText;
				el('rankProgress').style.width = data.rankProgressPercent + '%';
				el('autoBreak').textContent = 'Auto break: +' + data.autoBreakReward + 's every ' + data.autoBreakEvery + 's (next in ' + data.nextAutoBreakIn + 's)';
				el('activityProgress').textContent = 'Activity points: ' + data.activityPoints + ' / ' + data.pointsPerBreakSecond;
			});

			vscode.postMessage({ type: 'requestState' });
			setInterval(() => vscode.postMessage({ type: 'requestState' }), 1000);
		</script>
	</body>
	</html>
	`;
}

function pushDashboardState(context: vscode.ExtensionContext): void {
	if (!dashboardPanel || !session) {
		return;
	}

	const state = session.getState();
	const currentRank = getCurrentRank(state.workSeconds);
	const nextRank = getNextRank(state.workSeconds);
	const previousThreshold = getPreviousThreshold(state.workSeconds);
	const nextThreshold = nextRank?.minSeconds ?? state.workSeconds;
	const denom = Math.max(1, nextThreshold - previousThreshold);
	const rankProgressPercent = Math.max(0, Math.min(100, Math.round(((state.workSeconds - previousThreshold) / denom) * 100)));

	const nextRankText = nextRank
		? `${nextRank.name} in ${formatLongDuration(nextRank.minSeconds - state.workSeconds)}`
		: 'Top rank reached';

	dashboardPanel.webview.postMessage({
		type: 'state',
		work: formatLongDuration(state.workSeconds),
		break: formatLongDuration(state.breakSeconds),
		rank: currentRank,
		nextRankText,
		rankProgressPercent,
		activityPoints: state.activityPoints,
		pointsPerBreakSecond: state.pointsPerBreakSecond,
		autoBreakEvery: state.autoBreakIntervalSeconds,
		autoBreakReward: state.autoBreakRewardSeconds,
		nextAutoBreakIn: state.nextAutoBreakInSeconds,
		totalWork: context.globalState.get<number>('topChrono.totalWorkSeconds', 0) + state.workSeconds,
	});
}

function getPreviousThreshold(workSeconds: number): number {
	const thresholds = [0, ...RANKS.map((rank) => rank.minSeconds)];
	let prev = 0;
	for (const t of thresholds) {
		if (workSeconds >= t) {
			prev = t;
		}
	}
	return prev;
}