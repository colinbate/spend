import type { Budget, Expense, Place } from '#lib/db.ts';

export interface SpendBackup {
	app: 'spend';
	version: 1;
	exportedAt: string;
	expenses: Expense[];
	places: Place[];
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
	if (value.placeId !== undefined && typeof value.placeId !== 'string') {
		throw new Error(`Entry ${index + 1} has an invalid place.`);
	}
	if (!isDateString(value.occurredAt) || !isDateString(value.createdAt)) {
		throw new Error(`Entry ${index + 1} has an invalid date.`);
	}
	if (
		value.position !== undefined &&
		(!isRecord(value.position) ||
			typeof value.position.latitude !== 'number' ||
			!Number.isFinite(value.position.latitude) ||
			value.position.latitude < -90 ||
			value.position.latitude > 90 ||
			typeof value.position.longitude !== 'number' ||
			!Number.isFinite(value.position.longitude) ||
			value.position.longitude < -180 ||
			value.position.longitude > 180 ||
			typeof value.position.accuracy !== 'number' ||
			!Number.isFinite(value.position.accuracy) ||
			value.position.accuracy < 0)
	) {
		throw new Error(`Entry ${index + 1} has an invalid position.`);
	}

	return {
		id: value.id,
		amount: value.amount,
		category: value.category,
		location: value.location,
		...(typeof value.placeId === 'string' ? { placeId: value.placeId } : {}),
		...(value.position === undefined
			? {}
			: {
					position: {
						latitude: value.position.latitude as number,
						longitude: value.position.longitude as number,
						accuracy: value.position.accuracy as number,
					},
				}),
		occurredAt: value.occurredAt,
		createdAt: value.createdAt,
	};
}

function parsePlace(value: unknown, index: number): Place {
	if (!isRecord(value)) throw new Error(`Place ${index + 1} is not valid.`);
	if (
		typeof value.id !== 'string' ||
		value.id.length === 0 ||
		typeof value.name !== 'string' ||
		value.name.trim().length === 0 ||
		(value.category !== undefined &&
			(typeof value.category !== 'string' || value.category.trim().length === 0)) ||
		typeof value.latitude !== 'number' ||
		!Number.isFinite(value.latitude) ||
		value.latitude < -90 ||
		value.latitude > 90 ||
		typeof value.longitude !== 'number' ||
		!Number.isFinite(value.longitude) ||
		value.longitude < -180 ||
		value.longitude > 180 ||
		typeof value.radius !== 'number' ||
		!Number.isFinite(value.radius) ||
		value.radius <= 0 ||
		!isDateString(value.createdAt)
	) {
		throw new Error(`Place ${index + 1} is invalid.`);
	}

	return {
		id: value.id,
		name: value.name.trim(),
		...(typeof value.category === 'string' ? { category: value.category.trim() } : {}),
		latitude: value.latitude,
		longitude: value.longitude,
		radius: value.radius,
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
		value.weekStart > 6 ||
		(value.captureLocation !== undefined && typeof value.captureLocation !== 'boolean')
	) {
		throw new Error('The backup has invalid settings.');
	}

	return {
		weekly: value.weekly,
		monthly: value.monthly,
		weekStart: value.weekStart,
		captureLocation: value.captureLocation === true,
	};
}

export function createBackup(
	expenses: Expense[],
	settings: Budget,
	places: Place[] = []
): SpendBackup {
	return {
		app: 'spend',
		version: 1,
		exportedAt: new Date().toISOString(),
		expenses,
		places,
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
	if (
		!isDateString(value.exportedAt) ||
		!Array.isArray(value.expenses) ||
		(value.places !== undefined && !Array.isArray(value.places))
	) {
		throw new Error('The backup is incomplete.');
	}

	return {
		app: 'spend',
		version: 1,
		exportedAt: value.exportedAt,
		expenses: value.expenses.map(parseExpense),
		places: (value.places ?? []).map(parsePlace),
		settings: parseSettings(value.settings),
	};
}
