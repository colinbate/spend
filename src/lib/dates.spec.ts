import { describe, expect, it } from 'vitest';
import { getPeriodBounds } from './dates';

describe('getPeriodBounds', () => {
	it('starts a configured week on Saturday', () => {
		const { start, end } = getPeriodBounds(new Date(2026, 8, 21, 14), 'week', 6);

		expect(start).toEqual(new Date(2026, 8, 19));
		expect(end).toEqual(new Date(2026, 8, 26));
	});

	it('supports a different configured start day', () => {
		const { start, end } = getPeriodBounds(new Date(2026, 8, 21, 14), 'week', 1);

		expect(start).toEqual(new Date(2026, 8, 21));
		expect(end).toEqual(new Date(2026, 8, 28));
	});
});
