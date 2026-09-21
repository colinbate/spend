import { describe, expect, it } from 'vitest';
import { createBackup, parseBackupJson } from './backup';

const expense = {
	id: 'expense-1',
	amount: 42.5,
	category: 'Groceries',
	location: 'Market',
	occurredAt: '2026-09-20T15:30:00.000Z',
	createdAt: '2026-09-20T15:31:00.000Z',
};
const settings = { weekly: 200, monthly: 800, weekStart: 6 };

describe('Spend backups', () => {
	it('round-trips entries and settings', () => {
		const backup = createBackup([expense], settings);
		expect(parseBackupJson(JSON.stringify(backup))).toEqual(backup);
	});

	it('rejects another JSON format', () => {
		expect(() => parseBackupJson('{"expenses":[]}')).toThrow('supported Spend backup');
	});

	it('rejects malformed entries', () => {
		const backup = createBackup([{ ...expense, amount: -1 }], settings);
		expect(() => parseBackupJson(JSON.stringify(backup))).toThrow('invalid amount');
	});
});
