import type { Budget, Expense } from '#lib/db.ts';

export interface SpendBackup {
	app: 'spend';
	version: 1;
	exportedAt: string;
	expenses: Expense[];
	settings: Budget;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDateString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function parseExpense(value: unknown, index: number): Expense {
	if (!isRecord(value)) throw new Error(`Entry ${index + 1} is not valid.`);
	if (typeof value.id !== 'string' || value.id.length === 0) {
		throw new Error(`Entry ${index + 1} has no ID.`);
	}
	if (typeof value.amount !== 'number' || !Number.isFinite(value.amount) || value.amount <= 0) {
		throw new Error(`Entry ${index + 1} has an invalid amount.`);
	}
	if (typeof value.category !== 'string' || typeof value.location !== 'string') {
		throw new Error(`Entry ${index + 1} has invalid details.`);
	}
	if (!isDateString(value.occurredAt) || !isDateString(value.createdAt)) {
		throw new Error(`Entry ${index + 1} has an invalid date.`);
	}

	return {
		id: value.id,
		amount: value.amount,
		category: value.category,
		location: value.location,
		occurredAt: value.occurredAt,
		createdAt: value.createdAt,
	};
}

function parseSettings(value: unknown): Budget {
	if (!isRecord(value)) throw new Error('The backup has no valid settings.');
	if (
		typeof value.weekly !== 'number' ||
		!Number.isFinite(value.weekly) ||
		value.weekly < 0 ||
		typeof value.monthly !== 'number' ||
		!Number.isFinite(value.monthly) ||
		value.monthly < 0 ||
		typeof value.weekStart !== 'number' ||
		!Number.isInteger(value.weekStart) ||
		value.weekStart < 0 ||
		value.weekStart > 6
	) {
		throw new Error('The backup has invalid settings.');
	}

	return {
		weekly: value.weekly,
		monthly: value.monthly,
		weekStart: value.weekStart,
	};
}

export function createBackup(expenses: Expense[], settings: Budget): SpendBackup {
	return {
		app: 'spend',
		version: 1,
		exportedAt: new Date().toISOString(),
		expenses,
		settings,
	};
}

export function parseBackupJson(json: string): SpendBackup {
	let value: unknown;
	try {
		value = JSON.parse(json);
	} catch {
		throw new Error('That file is not valid JSON.');
	}

	if (!isRecord(value) || value.app !== 'spend' || value.version !== 1) {
		throw new Error('That file is not a supported Spend backup.');
	}
	if (!isDateString(value.exportedAt) || !Array.isArray(value.expenses)) {
		throw new Error('The backup is incomplete.');
	}

	return {
		app: 'spend',
		version: 1,
		exportedAt: value.exportedAt,
		expenses: value.expenses.map(parseExpense),
		settings: parseSettings(value.settings),
	};
}
