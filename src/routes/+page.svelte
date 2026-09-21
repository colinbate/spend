<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import { addExpense, getBudget, getExpenses, type Budget, type Expense } from '#lib/db.ts';
	import { formatCurrency, formatPeriodLabel, getPeriodBounds } from '#lib/dates.ts';

	let amount = $state('');
	let expenses = $state<Expense[]>([]);
	let budget = $state<Budget>({ weekly: 200, monthly: 800, weekStart: 6 });
	let saving = $state(false);
	let toast = $state('');
	let amountInput = $state<HTMLInputElement>();
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	const bounds = $derived(getPeriodBounds(new Date(), 'week', budget.weekStart));
	const weeklyTotal = $derived(
		expenses
			.filter((expense) => {
				const date = new Date(expense.occurredAt);
				return date >= bounds.start && date < bounds.end;
			})
			.reduce((sum, expense) => sum + expense.amount, 0)
	);
	const remaining = $derived(budget.weekly - weeklyTotal);
	const progress = $derived(
		budget.weekly > 0 ? Math.min((weeklyTotal / budget.weekly) * 100, 100) : 0
	);

	onMount(() => {
		void load();
		return () => clearTimeout(toastTimer);
	});

	async function load() {
		try {
			[expenses, budget] = await Promise.all([getExpenses(), getBudget()]);
		} catch {
			showToast('Could not load saved entries');
		} finally {
			await tick();
			amountInput?.focus();
		}
	}

	function focusAmount(element: HTMLInputElement) {
		amountInput = element;
		return () => {
			amountInput = undefined;
		};
	}

	function showToast(message: string) {
		clearTimeout(toastTimer);
		toast = message;
		toastTimer = setTimeout(() => (toast = ''), 2800);
	}

	async function captureExpense(event: SubmitEvent) {
		event.preventDefault();
		const parsedAmount = Number.parseFloat(amount);
		if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
			showToast('Enter an amount greater than zero');
			amountInput?.focus();
			return;
		}

		saving = true;
		try {
			const now = new Date().toISOString();
			const expense: Expense = {
				id: crypto.randomUUID(),
				amount: Math.round(parsedAmount * 100) / 100,
				category: 'Groceries',
				location: '',
				occurredAt: now,
				createdAt: now,
			};
			await addExpense(expense);
			expenses = [expense, ...expenses];
			amount = '';
			showToast(`${formatCurrency(expense.amount)} added`);
			await tick();
			amountInput?.focus();
		} catch {
			showToast('Could not save that entry');
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Add spending — Spend</title>
	<meta name="description" content="Quickly record an expense." />
</svelte:head>

<main class="capture-page">
	<h1 class="sr-only">Add spending</h1>

	<form class="quick-entry" onsubmit={captureExpense}>
		<div class="amount-input">
			<span aria-hidden="true">$</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				{@attach focusAmount}
				bind:value={amount}
				aria-label="Amount spent"
				inputmode="decimal"
				type="text"
				placeholder="0.00"
				autocomplete="off"
				autofocus
			/>
			<button type="submit" disabled={saving}>{saving ? 'Saving' : 'Add'}</button>
		</div>
	</form>

	<section class="week-summary" aria-label="Current week summary">
		<div class="summary-period">
			<span>{formatPeriodLabel(bounds.start, bounds.end, 'week')}</span>
			<a href="/settings">${budget.weekly.toFixed(0)} limit</a>
		</div>
		<div class="summary-values">
			<div>
				<span>Spent</span>
				<strong>{formatCurrency(weeklyTotal)}</strong>
			</div>
			<div class:negative={remaining < 0}>
				<span>{remaining < 0 ? 'Over' : 'Remaining'}</span>
				<strong>{formatCurrency(Math.abs(remaining))}</strong>
			</div>
		</div>
		<div class="budget-track" aria-label={`${Math.round(progress)}% of weekly limit spent`}>
			<div class:negative={remaining < 0} style:width={`${progress}%`}></div>
		</div>
	</section>
</main>

{#if toast}
	<div class="toast" role="status" transition:fly={{ y: 16, duration: 160 }}>{toast}</div>
{/if}
