export interface ExpensePosition {
	latitude: number;
	longitude: number;
	accuracy: number;
}

export interface Expense {
	id: string;
	amount: number;
	category: string;
	location: string;
	placeId?: string;
	position?: ExpensePosition;
	occurredAt: string;
	createdAt: string;
}

export interface Place {
	id: string;
	name: string;
	latitude: number;
	longitude: number;
	radius: number;
	createdAt: string;
}

export interface Budget {
	weekly: number;
	monthly: number;
	weekStart: number;
	captureLocation: boolean;
}

const DB_NAME = 'spend-local';
const DB_VERSION = 2;
const EXPENSES = 'expenses';
const SETTINGS = 'settings';
const PLACES = 'places';
const DEFAULT_BUDGET: Budget = {
	weekly: 200,
	monthly: 800,
	weekStart: 6,
	captureLocation: false,
};

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const database = request.result;
			if (!database.objectStoreNames.contains(EXPENSES)) {
				const store = database.createObjectStore(EXPENSES, { keyPath: 'id' });
				store.createIndex('occurredAt', 'occurredAt');
			}
			if (!database.objectStoreNames.contains(SETTINGS)) database.createObjectStore(SETTINGS);
			if (!database.objectStoreNames.contains(PLACES)) {
				database.createObjectStore(PLACES, { keyPath: 'id' });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function useStore<T>(
	storeName: string,
	mode: IDBTransactionMode,
	operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction(storeName, mode);
		const request = operation(transaction.objectStore(storeName));
		let result: T;
		request.onsuccess = () => {
			result = request.result;
		};
		transaction.oncomplete = () => {
			database.close();
			resolve(result);
		};
		transaction.onerror = () => {
			database.close();
			reject(transaction.error);
		};
	});
}

export async function getExpenses(): Promise<Expense[]> {
	const entries = await useStore<Expense[]>(EXPENSES, 'readonly', (store) => store.getAll());
	return entries.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function addExpense(expense: Expense): Promise<IDBValidKey> {
	return useStore(EXPENSES, 'readwrite', (store) => store.add(expense));
}
export function updateExpense(expense: Expense): Promise<IDBValidKey> {
	return useStore(EXPENSES, 'readwrite', (store) => store.put(expense));
}
export function deleteExpense(id: string): Promise<undefined> {
	return useStore(EXPENSES, 'readwrite', (store) => store.delete(id));
}
export async function getBudget(): Promise<Budget> {
	const saved = await useStore<Partial<Budget> | undefined>(SETTINGS, 'readonly', (store) =>
		store.get('budget')
	);
	return { ...DEFAULT_BUDGET, ...saved };
}
export function saveBudget(budget: Budget): Promise<IDBValidKey> {
	return useStore(SETTINGS, 'readwrite', (store) => store.put(budget, 'budget'));
}

export async function getPlaces(): Promise<Place[]> {
	const places = await useStore<Place[]>(PLACES, 'readonly', (store) => store.getAll());
	return places.sort((first, second) => first.name.localeCompare(second.name));
}

export function savePlace(place: Place): Promise<IDBValidKey> {
	return useStore(PLACES, 'readwrite', (store) => store.put(place));
}

export function deletePlace(id: string): Promise<undefined> {
	return useStore(PLACES, 'readwrite', (store) => store.delete(id));
}

export async function restoreBackup(
	expenses: Expense[],
	budget: Budget,
	places: Place[] = []
): Promise<void> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction([EXPENSES, SETTINGS, PLACES], 'readwrite');
		const expenseStore = transaction.objectStore(EXPENSES);

		for (const expense of expenses) expenseStore.put(expense);
		transaction.objectStore(SETTINGS).put(budget, 'budget');
		const placeStore = transaction.objectStore(PLACES);
		for (const place of places) placeStore.put(place);

		transaction.oncomplete = () => {
			database.close();
			resolve();
		};
		transaction.onabort = () => {
			database.close();
			reject(transaction.error ?? new Error('Could not import the backup.'));
		};
	});
}
