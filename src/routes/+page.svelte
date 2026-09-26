<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import {
		addExpense,
		getBudget,
		getExpenses,
		getPlaces,
		type Budget,
		type Expense,
	} from '#lib/db.ts';
	import { centsDigits, centsToAmount, formatCentsInput } from '#lib/amount.ts';
	import { formatCurrency, formatPeriodLabel, getPeriodBounds } from '#lib/dates.ts';
	import { captureCurrentPosition } from '#lib/geolocation.ts';
	import { findMatchingPlace } from '#lib/places.ts';

	let amountCents = $state('');
	let expenses = $state<Expense[]>([]);
	let budget = $state<Budget>({
		weekly: 200,
		monthly: 800,
		weekStart: 6,
		captureLocation: false,
	});
	let saving = $state(false);
	let savingLabel = $state('Saving');
	let toast = $state('');
	let amountInput = $state<HTMLInputElement>();
	let toastTimer: ReturnType<typeof setTimeout> | undefined;
	let focusTimer: ReturnType<typeof setTimeout> | undefined;

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
		return () => {
			clearTimeout(toastTimer);
			clearTimeout(focusTimer);
		};
	});

	async function load() {
		try {
			[expenses, budget] = await Promise.all([getExpenses(), getBudget()]);
		} catch {
			showToast('Could not load saved entries');
		} finally {
			await tick();
			scheduleAmountFocus();
		}
	}

	function focusAmount(element: HTMLInputElement) {
		amountInput = element;
		scheduleAmountFocus();
		return () => {
			amountInput = undefined;
		};
	}

	function scheduleAmountFocus(delay = 0) {
		clearTimeout(focusTimer);
		focusTimer = setTimeout(() => {
			if (document.visibilityState === 'visible' && !saving) {
				amountInput?.focus({ preventScroll: true });
			}
		}, delay);
	}

	function handleActivation() {
		// Installed PWAs can resume before their view is fully active, particularly on iOS.
		scheduleAmountFocus(80);
	}

	function handleVisibilityChange() {
		if (document.visibilityState === 'visible') handleActivation();
	}

	function showToast(message: string) {
		clearTimeout(toastTimer);
		toast = message;
		toastTimer = setTimeout(() => (toast = ''), 2800);
	}

	async function captureExpense(event: SubmitEvent) {
		event.preventDefault();
		const parsedAmount = centsToAmount(amountCents);
		if (parsedAmount === null) {
			showToast('Enter an amount greater than zero');
			scheduleAmountFocus();
			return;
		}

		saving = true;
		try {
			let position;
			let matchingPlace;
			let locationFailed = false;
			if (budget.captureLocation) {
				savingLabel = 'Locating';
				try {
					position = await captureCurrentPosition();
					matchingPlace = findMatchingPlace(position, await getPlaces());
				} catch {
					locationFailed = true;
				}
			}
			savingLabel = 'Saving';
			const now = new Date().toISOString();
			const expense: Expense = {
				id: crypto.randomUUID(),
				amount: Math.round(parsedAmount * 100) / 100,
				category: 'Groceries',
				location: matchingPlace?.name ?? '',
				...(matchingPlace ? { placeId: matchingPlace.id } : {}),
				...(position ? { position } : {}),
				occurredAt: now,
				createdAt: now,
			};
			await addExpense(expense);
			expenses = [expense, ...expenses];
			amountCents = '';
			showToast(
				`${formatCurrency(expense.amount)} added${locationFailed ? ' without location' : ''}`
			);
			await tick();
			scheduleAmountFocus();
		} catch {
			showToast('Could not save that entry');
		} finally {
			saving = false;
			savingLabel = 'Saving';
		}
	}
</script>

<svelte:window onfocus={handleActivation} onpageshow={handleActivation} />
<svelte:document onvisibilitychange={handleVisibilityChange} />

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
				bind:value={
					() => formatCentsInput(amountCents), (value) => (amountCents = centsDigits(value))
				}
				aria-label="Amount spent"
				inputmode="numeric"
				type="text"
				placeholder="0.00"
				autocomplete="off"
				autofocus
			/>
			<button type="submit" disabled={saving}>{saving ? savingLabel : 'Add'}</button>
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
