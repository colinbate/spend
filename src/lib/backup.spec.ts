import { describe, expect, it } from 'vitest';
import { createBackup, parseBackupJson } from './backup';

const expense = {
	id: 'expense-1',
	amount: 42.5,
	category: 'Groceries',
	location: 'Market',
	placeId: 'place-1',
	position: { latitude: 32.2948, longitude: -64.7814, accuracy: 8 },
	occurredAt: '2026-09-20T15:30:00.000Z',
	createdAt: '2026-09-20T15:31:00.000Z',
};
const settings = { weekly: 200, monthly: 800, weekStart: 6, captureLocation: true };
const place = {
	id: 'place-1',
	name: 'Market',
	latitude: 32.2948,
	longitude: -64.7814,
	radius: 75,
	createdAt: '2026-09-20T15:00:00.000Z',
};

describe('Spend backups', () => {
	it('round-trips entries and settings', () => {
		const backup = createBackup([expense], settings, [place]);
		expect(parseBackupJson(JSON.stringify(backup))).toEqual(backup);
	});

	it('rejects another JSON format', () => {
		expect(() => parseBackupJson('{"expenses":[]}')).toThrow('supported Spend backup');
	});

	it('rejects malformed entries', () => {
		const backup = createBackup([{ ...expense, amount: -1 }], settings);
		expect(() => parseBackupJson(JSON.stringify(backup))).toThrow('invalid amount');
	});

	it('loads older backups with location capture turned off', () => {
		const backup = createBackup([expense], settings);
		const oldBackup = JSON.parse(JSON.stringify(backup));
		delete oldBackup.settings.captureLocation;
		expect(parseBackupJson(JSON.stringify(oldBackup)).settings.captureLocation).toBe(false);
	});

	it('rejects coordinates outside the valid range', () => {
		const backup = createBackup(
			[{ ...expense, position: { ...expense.position, latitude: 91 } }],
			settings
		);
		expect(() => parseBackupJson(JSON.stringify(backup))).toThrow('invalid position');
	});

	it('loads older backups without places', () => {
		const backup = createBackup([expense], settings);
		const oldBackup = JSON.parse(JSON.stringify(backup));
		delete oldBackup.places;
		expect(parseBackupJson(JSON.stringify(oldBackup)).places).toEqual([]);
	});
});
