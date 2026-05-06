import * as vscode from 'vscode';
import { formatLongDuration } from './format';
import { getCurrentRank, getNextRank } from './ranks';
import { GLOBAL_MEDALS_KEY, GLOBAL_TOTAL_WORK_SECONDS_KEY, type SessionState } from './session';

export function buildGithubSummary(context: vscode.ExtensionContext, state: SessionState): string {
	const persistedTotal = context.globalState.get<number>(GLOBAL_TOTAL_WORK_SECONDS_KEY, 0);
	const medals = context.globalState.get<Record<string, number>>(GLOBAL_MEDALS_KEY, {});
	const totalWork = persistedTotal + state.workSeconds;
	const currentRank = getCurrentRank(state.workSeconds);
	const nextRank = getNextRank(state.workSeconds);
	const medalLines = Object.entries(medals)
		.sort((a, b) => b[1] - a[1])
		.map(([medal, count]) => `- ${medal}: ${count}`);

	const nextRankLine = nextRank
		? `${nextRank.name} in ${formatLongDuration(nextRank.minSeconds - state.workSeconds)}`
		: 'All ranks unlocked for this ladder';

	return [
		'## Top Chrono',
		'',
		`- Current rank: ${currentRank}`,
		`- Session work: ${formatLongDuration(state.workSeconds)}`,
		`- Session break earned: ${formatLongDuration(state.breakSeconds)}`,
		`- Total work: ${formatLongDuration(totalWork)}`,
		`- Next rank: ${nextRankLine}`,
		'',
		'### Medals',
		...(medalLines.length > 0 ? medalLines : ['- No medal yet']),
	].join('\n');
}
