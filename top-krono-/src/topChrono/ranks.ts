export type RankDefinition = {
	name: string;
	minSeconds: number;
	medal: string;
};

export const RANKS: RankDefinition[] = [
	{ name: 'Padawan', minSeconds: 30, medal: 'padawan' },
	{ name: 'Cadet Jedi', minSeconds: 60, medal: 'cadet-jedi' },
	{ name: 'Chevalier Jedi', minSeconds: 90, medal: 'chevalier-jedi' },
	{ name: 'Maitre Jedi', minSeconds: 120, medal: 'maitre-jedi' },
	{ name: 'General Jedi', minSeconds: 150, medal: 'general-jedi' },
	{ name: 'Maitre Sith', minSeconds: 180, medal: 'maitre-sith' },
];

export function getCurrentRank(seconds: number): string {
	let currentRank = 'Novice';

	for (const rank of RANKS) {
		if (seconds >= rank.minSeconds) {
			currentRank = rank.name;
		}
	}

	return currentRank;
}

export function getNextRank(seconds: number): RankDefinition | undefined {
	return RANKS.find((rank) => seconds < rank.minSeconds);
}
