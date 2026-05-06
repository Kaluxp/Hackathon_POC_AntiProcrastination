import * as vscode from 'vscode';
import { formatLongDuration, formatShortMinutes } from './format';
import { getCurrentRank } from './ranks';
import type { SessionState } from './session';

export function renderStatusBar(statusBarItem: vscode.StatusBarItem, state: SessionState): void {
	const rank = getCurrentRank(state.workSeconds);
	if (state.isOnBreak) {
		statusBarItem.text = `$(coffee) Pause ${formatShortMinutes(state.currentBreakSeconds)} | credit ${formatShortMinutes(state.breakSeconds)} | $(flame) ${rank}`;
		statusBarItem.tooltip = `Top Chrono\nMode: Pause en cours\nPause utilisee: ${formatLongDuration(state.currentBreakSeconds)}\nPause autorisee: ${formatLongDuration(state.currentBreakAllowedSeconds)}\nDepassement: ${formatLongDuration(state.breakOverrunSeconds)}\nRang: ${rank}`;
		statusBarItem.show();
		return;
	}

	statusBarItem.text = `$(clock) ${formatShortMinutes(state.workSeconds)} | $(coffee) ${formatShortMinutes(state.breakSeconds)} | $(flame) ${rank}`;
	statusBarItem.tooltip = `Top Chrono\nTravail: ${formatLongDuration(state.workSeconds)}\nPause disponible: ${formatLongDuration(state.breakSeconds)}\nRang: ${rank}`;
	statusBarItem.show();
}
