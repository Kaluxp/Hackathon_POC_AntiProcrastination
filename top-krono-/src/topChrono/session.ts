import * as vscode from 'vscode';
import { RANKS } from './ranks';

export const GLOBAL_TOTAL_WORK_SECONDS_KEY = 'topChrono.totalWorkSeconds';
export const GLOBAL_MEDALS_KEY = 'topChrono.medals';

const ACTIVITY_COOLDOWN_MS = 500;
const POINTS_PER_BREAK_SECOND = 3;
const AUTO_BREAK_INTERVAL_SECONDS = 30;
const AUTO_BREAK_REWARD_SECONDS = 10;

export type SessionState = {
	workSeconds: number;
	breakSeconds: number;
	isRunning: boolean;
	activityPoints: number;
	pointsPerBreakSecond: number;
	autoBreakIntervalSeconds: number;
	autoBreakRewardSeconds: number;
	nextAutoBreakInSeconds: number;
};

export class TopChronoSession {
	private timer: NodeJS.Timeout | undefined;
	private workSeconds = 0;
	private breakSeconds = 0;
	private activityPoints = 0;
	private isRunning = false;
	private lastActivityAt = 0;
	private unlockedSessionMedals = new Set<string>();
	private persisted = false;
	private elapsedSinceAutoBreak = 0;

	public constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly onStateChanged: () => void
	) {}

	public start(): boolean {
		if (this.isRunning) {
			return false;
		}

		this.isRunning = true;
		this.workSeconds = 0;
		this.breakSeconds = 0;
		this.activityPoints = 0;
		this.lastActivityAt = 0;
		this.unlockedSessionMedals = new Set<string>();
		this.elapsedSinceAutoBreak = 0;

		this.timer = setInterval(() => {
			this.workSeconds += 1;
			this.elapsedSinceAutoBreak += 1;
			if (this.elapsedSinceAutoBreak >= AUTO_BREAK_INTERVAL_SECONDS) {
				this.breakSeconds += AUTO_BREAK_REWARD_SECONDS;
				this.elapsedSinceAutoBreak = 0;
			}
			this.unlockMedalsIfNeeded();
			this.onStateChanged();
		}, 1_000);

		this.onStateChanged();
		return true;
	}

	public stop(): void {
		if (!this.isRunning) {
			return;
		}

		if (this.timer) {
			clearInterval(this.timer);
			this.timer = undefined;
		}

		this.isRunning = false;
	}

	public addActivityPoints(points: number): void {
		if (!this.isRunning || points <= 0) {
			return;
		}

		const now = Date.now();
		if (now - this.lastActivityAt < ACTIVITY_COOLDOWN_MS) {
			return;
		}
		this.lastActivityAt = now;

		this.activityPoints += points;
		while (this.activityPoints >= POINTS_PER_BREAK_SECOND) {
			this.breakSeconds += 1;
			this.activityPoints -= POINTS_PER_BREAK_SECOND;
		}

		this.onStateChanged();
	}

	public getState(): SessionState {
		return {
			workSeconds: this.workSeconds,
			breakSeconds: this.breakSeconds,
			isRunning: this.isRunning,
			activityPoints: this.activityPoints,
			pointsPerBreakSecond: POINTS_PER_BREAK_SECOND,
			autoBreakIntervalSeconds: AUTO_BREAK_INTERVAL_SECONDS,
			autoBreakRewardSeconds: AUTO_BREAK_REWARD_SECONDS,
			nextAutoBreakInSeconds: AUTO_BREAK_INTERVAL_SECONDS - this.elapsedSinceAutoBreak,
		};
	}

	public getSessionMedals(): string[] {
		return [...this.unlockedSessionMedals];
	}

	public async dispose(): Promise<void> {
		this.stop();
		if (this.persisted) {
			return;
		}

		const previousTotal = this.context.globalState.get<number>(GLOBAL_TOTAL_WORK_SECONDS_KEY, 0);
		await this.context.globalState.update(GLOBAL_TOTAL_WORK_SECONDS_KEY, previousTotal + this.workSeconds);

		const medals = this.context.globalState.get<Record<string, number>>(GLOBAL_MEDALS_KEY, {});
		for (const medal of this.unlockedSessionMedals) {
			medals[medal] = (medals[medal] ?? 0) + 1;
		}
		await this.context.globalState.update(GLOBAL_MEDALS_KEY, medals);
		this.persisted = true;
	}

	private unlockMedalsIfNeeded(): void {
		for (const rank of RANKS) {
			if (this.workSeconds >= rank.minSeconds) {
				this.unlockedSessionMedals.add(rank.medal);
			}
		}
	}
}
