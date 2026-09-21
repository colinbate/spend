<script lang="ts">
	import { onMount } from 'svelte';
	import {
		deleteExpense,
		getBudget,
		getExpenses,
		updateExpense,
		type Budget,
		type Expense,
	} from '#lib/db.ts';
	import {
		formatCompactDate,
		formatCurrency,
		formatPeriodLabel,
		getPeriodBounds,
		isSameDay,
		type Period,
	} from '#lib/dates.ts';

	const categories = ['Groceries', 'Personal care', 'Gas', 'Household', 'Other'];
	let expenses = $state<Expense[]>([]);
	let budget = $state<Budget>({ weekly: 200, monthly: 800, weekStart: 6 });
	let period = $state<Period>('week');
	let anchorDate = $state(new Date());
	let loading = $state(true);
	let editing = $state<Expense | null>(null);
	let editAmount = $state('');
	let editCategory = $state('Groceries');
	let editLocation = $state('');
	let editDate = $state('');

	const bounds = $derived(getPeriodBounds(anchorDate, period, budget.weekStart));
	const visibleExpenses = $derived(
		expenses.filter((expense) => {
			const date = new Date(expense.occurredAt);
			return date >= bounds.start && date < bounds.end;
		})
	);
	const total = $derived(visibleExpenses.reduce((sum, expense) => sum + expense.amount, 0));

	onMount(async () => {
		[expenses, budget] = await Promise.all([getExpenses(), getBudget()]);
		loading = false;
	});

	function changePeriod(next: Period) {
		period = next;
		anchorDate = new Date();
	}

	function movePeriod(direction: -1 | 1) {
		anchorDate =
			period === 'week'
				? new Date(anchorDate.getTime() + direction * 7 * 24 * 60 * 60 * 1000)
				: new Date(anchorDate.getFullYear(), anchorDate.getMonth() + direction, 1);
	}

	function openEdit(expense: Expense) {
		editing = expense;
		editAmount = expense.amount.toFixed(2);
		editCategory = expense.category;
		editLocation = expense.location;
		editDate = toLocalInputValue(expense.occurredAt);
	}

	async function saveEdit(event: SubmitEvent) {
		event.preventDefault();
		if (!editing) return;
		const parsedAmount = Number.parseFloat(editAmount);
		const parsedDate = new Date(editDate);
		if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || Number.isNaN(parsedDate.getTime()))
			return;
		const updated: Expense = {
			...editing,
			amount: Math.round(parsedAmount * 100) / 100,
			category: editCategory,
			location: editLocation.trim(),
			occurredAt: parsedDate.toISOString(),
		};
		await updateExpense(updated);
		expenses = expenses.map((expense) => (expense.id === updated.id ? updated : expense));
		editing = null;
	}

	async function removeExpense() {
		if (!editing) return;
		const id = editing.id;
		await deleteExpense(id);
		expenses = expenses.filter((expense) => expense.id !== id);
		editing = null;
	}

	function toLocalInputValue(isoDate: string) {
		const date = new Date(isoDate);
		return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
	}
</script>

<svelte:head><title>History — Spend</title></svelte:head>

<main class="standard-page">
	<div class="page-heading">
		<h1>History</h1>
		<div class="segmented" aria-label="History period">
			<button class:active={period === 'week'} type="button" onclick={() => changePeriod('week')}
				>Week</button
			>
			<button class:active={period === 'month'} type="button" onclick={() => changePeriod('month')}
				>Month</button
			>
		</div>
	</div>

	<div class="history-period">
		<button type="button" onclick={() => movePeriod(-1)} aria-label={`Previous ${period}`}>←</button
		>
		<button type="button" onclick={() => (anchorDate = new Date())}
			>{formatPeriodLabel(bounds.start, bounds.end, period)}</button
		>
		<button type="button" onclick={() => movePeriod(1)} aria-label={`Next ${period}`}>→</button>
	</div>

	<div class="history-total"><span>Total</span><strong>{formatCurrency(total)}</strong></div>

	{#if loading}
		<p class="empty-message">Loading…</p>
	{:else if visibleExpenses.length === 0}
		<p class="empty-message">No entries in this {period}.</p>
	{:else}
		<div class="entry-list">
			{#each visibleExpenses as expense (expense.id)}
				<button class="entry-row" type="button" onclick={() => openEdit(expense)}>
					<span class="entry-main"
						><strong>{expense.category}</strong><small
							>{formatCompactDate(
								expense.occurredAt,
								isSameDay(expense.occurredAt, new Date())
							)}{#if expense.location}
								· {expense.location}{/if}</small
						></span
					>
					<strong>{formatCurrency(expense.amount)}</strong>
				</button>
			{/each}
		</div>
	{/if}
</main>

{#if editing}
	<div
		class="modal-backdrop"
		role="presentation"
		onclick={(event) => event.target === event.currentTarget && (editing = null)}
	>
		<div class="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
			<div class="modal-heading">
				<h2 id="edit-title">Edit entry</h2>
				<button type="button" onclick={() => (editing = null)} aria-label="Close">×</button>
			</div>
			<form onsubmit={saveEdit}>
				<label for="edit-amount">Amount</label>
				<div class="field-with-prefix">
					<span>$</span><input id="edit-amount" inputmode="decimal" bind:value={editAmount} />
				</div>
				<label for="edit-category">Category</label><select
					id="edit-category"
					bind:value={editCategory}
					>{#each categories as category (category)}<option>{category}</option>{/each}</select
				>
				<label for="edit-location">Location <span>optional</span></label><input
					id="edit-location"
					bind:value={editLocation}
				/>
				<label for="edit-date">Date and time</label><input
					id="edit-date"
					type="datetime-local"
					bind:value={editDate}
				/>
				<div class="form-actions">
					<button class="danger-button" type="button" onclick={removeExpense}>Delete</button><button
						class="primary-button"
						type="submit">Save</button
					>
				</div>
			</form>
		</div>
	</div>
{/if}
