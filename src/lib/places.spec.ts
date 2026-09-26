import { describe, expect, it } from 'vitest';
import type { Place } from './db';
import { distanceInMeters, findMatchingPlace } from './places';

const market: Place = {
	id: 'market',
	name: 'Market',
	latitude: 32.2948,
	longitude: -64.7814,
	radius: 75,
	createdAt: '2026-09-26T12:00:00.000Z',
};

describe('place matching', () => {
	it('calculates distance between coordinates', () => {
		expect(distanceInMeters(market, { latitude: 32.2958, longitude: -64.7814 })).toBeCloseTo(
			111.2,
			0
		);
	});

	it('matches a position inside a place radius', () => {
		expect(
			findMatchingPlace({ latitude: 32.2949, longitude: -64.7814, accuracy: 8 }, [market])?.name
		).toBe('Market');
	});

	it('chooses the closest place when radii overlap', () => {
		const closer = { ...market, id: 'closer', name: 'Closer', latitude: 32.2949 };
		expect(
			findMatchingPlace({ latitude: 32.29491, longitude: -64.7814, accuracy: 8 }, [market, closer])
				?.id
		).toBe('closer');
	});

	it('does not match a position outside every radius', () => {
		expect(
			findMatchingPlace({ latitude: 32.3, longitude: -64.7814, accuracy: 8 }, [market])
		).toBeUndefined();
	});
});
