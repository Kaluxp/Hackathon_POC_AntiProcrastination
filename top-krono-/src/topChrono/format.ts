export function formatShortMinutes(totalSeconds: number): string {
	return `${Math.floor(totalSeconds / 60)}m`;
}

export function formatLongDuration(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);

	if (hours === 0) {
		return `${minutes}m`;
	}

	return `${hours}h ${minutes}m`;
}
