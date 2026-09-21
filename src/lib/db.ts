export interface Expense {
	id: string;
	amount: number;
	category: string;
	location: string;
	occurredAt: string;
	createdAt: string;
}

export interface Budget {
	weekly: number;
	monthly: number;
	weekStart: number;
}

const DB_NAME = 'spend-local';
const DB_VERSION = 1;
const EXPENSES = 'expenses';
const SETTINGS = 'settings';
const DEFAULT_BUDGET: Budget = { weekly: 200, monthly: 800, weekStart: 6 };

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
