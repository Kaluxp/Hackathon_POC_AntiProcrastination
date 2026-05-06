import * as vscode from 'vscode';
import { formatLongDuration, formatShortMinutes } from './format';
import { getCurrentRank } from './ranks';
import type { SessionState } from './session';

export function renderStatusBar(statusBarItem: vscode.StatusBarItem, state: SessionState): void {
	const rank = getCurrentRank(state.workSeconds);
	statusBarItem.text = `$(clock) ${formatShortMinutes(state.workSeconds)} | $(coffee) ${formatShortMinutes(state.breakSeconds)} | $(flame) ${rank}`;
	statusBarItem.tooltip = `Top Chrono\nTravail: ${formatLongDuration(state.workSeconds)}\nPause: ${formatLongDuration(state.breakSeconds)}\nRang: ${rank}`;
	statusBarItem.show();
}
