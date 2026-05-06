import * as vscode from 'vscode';
import { formatLongDuration } from './topChrono/format';
import { buildGithubSummary } from './topChrono/github';
import { getCurrentRank, getNextRank, RANKS } from './topChrono/ranks';
import { GLOBAL_MEDALS_KEY, GLOBAL_TOTAL_WORK_SECONDS_KEY, TopChronoSession } from './topChrono/session';
import { renderStatusBar } from './topChrono/statusBar';

let session: TopChronoSession | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let dashboardPanel: vscode.WebviewPanel | undefined;
let overrunAlertShownForCurrentBreak = false;
let overrunModalInFlight = false;

export function activate(context: vscode.ExtensionContext): void {
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.command = 'top-krono.openDashboard';
	context.subscriptions.push(statusBarItem);

	session = new TopChronoSession(context, () => {
		if (statusBarItem && session) {
			const state = session.getState();
			renderStatusBar(statusBarItem, state);
			void handleBreakOverrunAlert(state);
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
			localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'assets')],
		});
		const padawanIconUri = dashboardPanel.webview.asWebviewUri(
			vscode.Uri.joinPath(context.extensionUri, 'assets', 'icons', 'image.png')
		);
		dashboardPanel.webview.html = getWebviewContent(padawanIconUri.toString());

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
				case 'startBreak':
					if (session.startBreak()) {
						vscode.window.showInformationMessage('Pause started. Good recovery.');
					}
					pushDashboardState(context);
					break;
				case 'endBreak':
					if (session.endBreak()) {
						vscode.window.showInformationMessage('Break ended. Back to focus mode.');
					}
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
	const startBreakCommand = vscode.commands.registerCommand('top-krono.startBreak', () => {
		if (!session) {
			return;
		}
		if (session.startBreak()) {
			vscode.window.showInformationMessage('Pause started. Good recovery.');
			return;
		}
		vscode.window.showWarningMessage('Cannot start break now.');
	});
	const endBreakCommand = vscode.commands.registerCommand('top-krono.endBreak', () => {
		if (!session) {
			return;
		}
		if (session.endBreak()) {
			vscode.window.showInformationMessage('Break ended. Back to focus mode.');
			return;
		}
		vscode.window.showWarningMessage('No active break to end.');
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
		startBreakCommand,
		endBreakCommand,
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

function getWebviewContent(padawanIconUri: string): string {
	return `
	<!DOCTYPE html>
	<html lang="fr">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Top Chrono — HUD</title>
		<style>
			:root {
				--bg-deep: #0a0a0f;
				--bg-panel: rgba(18, 16, 28, 0.92);
				--border: rgba(139, 92, 246, 0.45);
				--glow: rgba(167, 139, 250, 0.35);
				--text: #e8e6ed;
				--muted: #9ca3af;
				--violet: #a78bfa;
				--violet-deep: #7c3aed;
				--cyan: #22d3ee;
				--danger: #f87171;
			}

			* { box-sizing: border-box; }

			body {
				margin: 0;
				min-height: 100vh;
				background: var(--bg-deep);
				background-image:
					radial-gradient(ellipse 120% 80% at 50% -20%, rgba(124, 58, 237, 0.18), transparent 50%),
					linear-gradient(180deg, #0c0c14 0%, var(--bg-deep) 40%);
				color: var(--text);
				font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif;
				font-size: 13px;
				padding: 16px 18px 24px;
			}

			.hud-shell {
				max-width: 420px;
				margin: 0 auto;
			}

			.hud-header {
				display: flex;
				align-items: baseline;
				justify-content: space-between;
				padding-bottom: 12px;
				border-bottom: 1px solid var(--border);
				box-shadow: 0 1px 0 0 var(--glow);
				margin-bottom: 16px;
			}

			.hud-title {
				font-size: 15px;
				font-weight: 800;
				letter-spacing: 0.2em;
				color: var(--text);
				text-shadow: 0 0 24px var(--glow);
			}

			.hud-tag {
				font-size: 10px;
				color: var(--violet);
				letter-spacing: 0.12em;
				text-transform: uppercase;
			}

			.hud-card {
				background: var(--bg-panel);
				border: 1px solid var(--border);
				border-radius: 14px;
				padding: 16px;
				margin-bottom: 12px;
				box-shadow:
					0 0 0 1px rgba(0,0,0,0.4) inset,
					0 8px 32px rgba(0,0,0,0.45),
					0 0 40px -12px var(--glow);
				backdrop-filter: blur(8px);
			}

			.hud-card-title {
				font-size: 10px;
				font-weight: 700;
				letter-spacing: 0.15em;
				color: var(--muted);
				margin-bottom: 12px;
				text-transform: uppercase;
			}

			.rank-row {
				display: flex;
				gap: 14px;
				align-items: flex-start;
			}

			.rank-icon {
				width: 64px;
				height: 64px;
				border-radius: 12px;
				border: 1px solid var(--border);
				object-fit: cover;
				flex-shrink: 0;
				display: none;
				box-shadow: 0 0 20px var(--glow);
			}

			.rank-name {
				font-size: 20px;
				font-weight: 800;
				letter-spacing: 0.06em;
				text-transform: uppercase;
				color: var(--violet);
				text-shadow: 0 0 20px rgba(167, 139, 250, 0.5);
				line-height: 1.2;
			}

			.rank-timer-line {
				margin-top: 8px;
				font-variant-numeric: tabular-nums;
				font-size: 14px;
				color: var(--text);
			}

			.rank-timer-line .sep {
				color: var(--muted);
				margin: 0 6px;
			}

			.rank-timer-line .goal {
				color: var(--violet);
			}

			.progress-hud {
				margin-top: 12px;
				height: 6px;
				background: rgba(30, 27, 45, 0.9);
				border-radius: 999px;
				overflow: hidden;
				border: 1px solid rgba(139, 92, 246, 0.25);
			}

			.progress-fill {
				height: 100%;
				width: 0%;
				border-radius: 999px;
				background: linear-gradient(90deg, var(--violet-deep), var(--cyan));
				box-shadow: 0 0 12px var(--glow);
				transition: width 0.35s ease;
			}

			.progress-meta {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-top: 8px;
			}

			.rank-pct {
				font-size: 12px;
				font-weight: 700;
				color: var(--cyan);
			}

			.next-rank-hint {
				font-size: 11px;
				color: var(--muted);
				margin-top: 6px;
				line-height: 1.4;
			}

			.stats-grid {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 10px;
			}

			.stat-tile {
				background: rgba(12, 10, 20, 0.65);
				border: 1px solid rgba(139, 92, 246, 0.2);
				border-radius: 10px;
				padding: 10px 12px;
			}

			.stat-tile .label {
				font-size: 9px;
				text-transform: uppercase;
				letter-spacing: 0.12em;
				color: var(--muted);
			}

			.stat-tile .value {
				margin-top: 6px;
				font-size: 15px;
				font-weight: 700;
				font-variant-numeric: tabular-nums;
			}

			.stat-tile.break .value { color: var(--violet); }

			.pause-list {
				list-style: none;
				padding: 0;
				margin: 0;
			}

			.pause-list li {
				padding: 6px 0;
				border-bottom: 1px solid rgba(139, 92, 246, 0.12);
				font-size: 12px;
				color: var(--muted);
			}

			.pause-list li:last-child { border-bottom: none; }

			.pill-hud {
				display: inline-block;
				margin-top: 8px;
				padding: 4px 10px;
				border-radius: 999px;
				font-size: 10px;
				font-weight: 600;
				letter-spacing: 0.06em;
				text-transform: uppercase;
				background: rgba(124, 58, 237, 0.25);
				color: var(--violet);
				border: 1px solid var(--border);
			}

			.pill-hud.danger {
				background: rgba(248, 113, 113, 0.15);
				color: var(--danger);
				border-color: rgba(248, 113, 113, 0.35);
			}

			.actions-hud {
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
				margin-top: 14px;
			}

			.btn {
				padding: 10px 14px;
				border: none;
				border-radius: 10px;
				font-size: 11px;
				font-weight: 700;
				letter-spacing: 0.04em;
				cursor: pointer;
				transition: transform 0.12s, box-shadow 0.12s;
			}

			.btn:active { transform: scale(0.98); }

			.btn-primary {
				background: linear-gradient(135deg, var(--violet-deep), #6d28d9);
				color: #fff;
				box-shadow: 0 4px 20px rgba(124, 58, 237, 0.4);
			}

			.btn-primary:hover {
				box-shadow: 0 6px 28px rgba(124, 58, 237, 0.55);
			}

			.btn-ghost {
				background: transparent;
				color: var(--text);
				border: 1px solid rgba(139, 92, 246, 0.4);
			}

			.btn-ghost:hover {
				background: rgba(139, 92, 246, 0.12);
			}

			.btn-danger {
				background: linear-gradient(135deg, #dc2626, #b91c1c);
				color: #fff;
				box-shadow: 0 4px 16px rgba(220, 38, 38, 0.35);
			}
		</style>
	</head>
	<body>
		<div class="hud-shell">
			<header class="hud-header">
				<span class="hud-title">TOP CHRONO</span>
				<span class="hud-tag">HUD</span>
			</header>

			<section class="hud-card">
				<div class="hud-card-title">Rang & progression</div>
				<div class="rank-row">
					<img id="padawanIcon" class="rank-icon" src="${padawanIconUri}" alt="Padawan" />
					<div style="flex:1; min-width:0">
						<div id="rank" class="rank-name">Novice</div>
						<div class="rank-timer-line">
							<span id="work">0m 0s</span><span class="sep">/</span><span id="nextRankGoal" class="goal">—</span>
						</div>
						<div class="progress-hud">
							<div id="rankProgress" class="progress-fill"></div>
						</div>
						<div class="progress-meta">
							<span id="nextRank" class="next-rank-hint">Prochain rang : —</span>
							<span id="rankPct" class="rank-pct">0%</span>
						</div>
					</div>
				</div>
			</section>

			<section class="hud-card">
				<div class="hud-card-title">Stats session</div>
				<div class="stats-grid">
					<div class="stat-tile">
						<div class="label">Temps de travail</div>
						<div id="workStat" class="value">0m 0s</div>
					</div>
					<div class="stat-tile break">
						<div class="label">Pause disponible</div>
						<div id="break" class="value">0m 0s</div>
					</div>
					<div class="stat-tile">
						<div class="label">Temps total (global)</div>
						<div id="totalWork" class="value">0m 0s</div>
					</div>
					<div class="stat-tile">
						<div class="label">Médailles (total)</div>
						<div id="medalCount" class="value">0</div>
					</div>
				</div>
			</section>

			<section class="hud-card">
				<div class="hud-card-title">Système pause</div>
				<div id="breakState" class="pill-hud">Repos : inactif</div>
				<ul class="pause-list">
					<li id="autoBreak">Bonus auto : —</li>
					<li id="activityProgress">Points activité : —</li>
					<li id="breakUsage">Pause en cours : —</li>
					<li id="breakOverrun">Dépassement : —</li>
				</ul>
				<div class="actions-hud">
					<button id="startBtn" class="btn btn-primary">Démarrer</button>
					<button id="startBreakBtn" class="btn btn-ghost">Pause</button>
					<button id="endBreakBtn" class="btn btn-ghost">Reprendre</button>
					<button id="copyBtn" class="btn btn-ghost">Export GitHub</button>
				</div>
			</section>
		</div>

		<script>
			const vscode = acquireVsCodeApi();
			const el = (id) => document.getElementById(id);

			el('startBtn').addEventListener('click', () => vscode.postMessage({ type: 'start' }));
			el('startBreakBtn').addEventListener('click', () => vscode.postMessage({ type: 'startBreak' }));
			el('endBreakBtn').addEventListener('click', () => vscode.postMessage({ type: 'endBreak' }));
			el('copyBtn').addEventListener('click', () => vscode.postMessage({ type: 'copyGithub' }));

			window.addEventListener('message', (event) => {
				const data = event.data;
				if (!data || data.type !== 'state') {
					return;
				}

				el('work').textContent = data.work;
				el('workStat').textContent = data.work;
				el('break').textContent = data.break;
				el('totalWork').textContent = data.totalWorkFormatted;
				el('medalCount').textContent = String(data.medalCount);
				el('rank').textContent = data.rankUpper;
				el('nextRankGoal').textContent = data.nextRankGoal;
				el('nextRank').textContent = data.nextRankHint;
				el('rankProgress').style.width = data.rankProgressPercent + '%';
				el('rankPct').textContent = data.rankProgressPercent + '%';
				el('autoBreak').textContent = 'Bonus auto : +' + data.autoBreakReward + 's / ' + data.autoBreakEvery + 's (prochain dans ' + data.nextAutoBreakIn + 's)';
				el('activityProgress').textContent = 'Points activité : ' + data.activityPoints + ' / ' + data.pointsPerBreakSecond;
				el('breakState').textContent = data.isOnBreak ? 'État : PAUSE' : 'État : FOCUS';
				el('breakState').className = 'pill-hud' + (data.isOnBreak ? ' danger' : '');
				el('breakUsage').textContent = 'Pause en cours : ' + data.currentBreak + ' / crédit ' + data.currentBreakAllowed;
				el('breakOverrun').textContent = 'Dépassement : ' + data.breakOverrun;
				el('padawanIcon').style.display = data.showPadawanIcon ? 'block' : 'none';
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

	const persistedTotal = context.globalState.get<number>(GLOBAL_TOTAL_WORK_SECONDS_KEY, 0);
	const totalWorkSeconds = persistedTotal + state.workSeconds;
	const medals = context.globalState.get<Record<string, number>>(GLOBAL_MEDALS_KEY, {});
	const medalCount = Object.values(medals).reduce((sum, n) => sum + n, 0);

	const nextRankGoal = nextRank ? formatLongDuration(nextRank.minSeconds) : '—';
	const nextRankHint = nextRank
		? `Prochain rang : ${nextRank.name} · ${formatLongDuration(nextRank.minSeconds - state.workSeconds)} restants`
		: 'Palier max atteint sur cette échelle';

	dashboardPanel.webview.postMessage({
		type: 'state',
		work: formatLongDuration(state.workSeconds),
		break: formatLongDuration(state.breakSeconds),
		rankUpper: currentRank.toUpperCase(),
		nextRankGoal,
		nextRankHint,
		rankProgressPercent,
		activityPoints: state.activityPoints,
		pointsPerBreakSecond: state.pointsPerBreakSecond,
		isOnBreak: state.isOnBreak,
		currentBreak: formatLongDuration(state.currentBreakSeconds),
		currentBreakAllowed: formatLongDuration(state.currentBreakAllowedSeconds),
		breakOverrun: formatLongDuration(state.breakOverrunSeconds),
		showPadawanIcon: currentRank === 'Padawan',
		autoBreakEvery: state.autoBreakIntervalSeconds,
		autoBreakReward: state.autoBreakRewardSeconds,
		nextAutoBreakIn: state.nextAutoBreakInSeconds,
		totalWorkFormatted: formatLongDuration(totalWorkSeconds),
		medalCount,
	});
}

async function handleBreakOverrunAlert(state: ReturnType<TopChronoSession['getState']>): Promise<void> {
	if (!state.isOnBreak) {
		overrunAlertShownForCurrentBreak = false;
		return;
	}

	if (state.breakOverrunSeconds <= 0 || overrunAlertShownForCurrentBreak || overrunModalInFlight) {
		return;
	}

	overrunAlertShownForCurrentBreak = true;
	overrunModalInFlight = true;

	vscode.window.showWarningMessage(
		`Pause depassee: ${formatLongDuration(state.breakOverrunSeconds)} de plus que le credit.`,
		'Reprendre le chrono'
	);

	try {
		const choice = await vscode.window.showWarningMessage(
			`PAUSE DEPASSEE !\nTu as depasse ton temps de pause autorise.\nPause autorisee: ${formatLongDuration(state.currentBreakAllowedSeconds)}\nPause actuelle: ${formatLongDuration(state.currentBreakSeconds)}`,
			{ modal: true },
			'Reprendre le chrono',
			'Ignorer 5 min'
		);

		if (choice === 'Reprendre le chrono') {
			session?.endBreak();
		}
	} finally {
		overrunModalInFlight = false;
	}
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