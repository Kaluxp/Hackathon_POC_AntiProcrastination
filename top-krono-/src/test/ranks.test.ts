import * as assert from 'assert';
import { getCurrentRank, getNextRank } from '../topChrono/ranks';

suite('Ranks logic', () => {
	test('Returns Novice before first threshold', () => {
		assert.strictEqual(getCurrentRank(0), 'Novice');
	});

	test('Returns expected rank at threshold', () => {
		assert.strictEqual(getCurrentRank(5 * 60), 'Padawan');
		assert.strictEqual(getCurrentRank(10 * 60), 'Cadet Jedi');
	});

	test('Returns next rank when available', () => {
		const next = getNextRank(6 * 60);
		assert.strictEqual(next?.name, 'Cadet Jedi');
	});
});
