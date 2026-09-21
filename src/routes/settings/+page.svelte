<script lang="ts">
	import { onMount } from 'svelte';
	import { getBudget, saveBudget, type Budget } from '#lib/db.ts';

	const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	let weekly = $state('200');
	let monthly = $state('800');
	let weekStart = $state(6);
	let saved = $state(false);
	let savedTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		void load();
		return () => clearTimeout(savedTimer);
	});

	async function load() {
		const budget = await getBudget();
		weekly = budget.weekly.toString();
		monthly = budget.monthly.toString();
		weekStart = budget.weekStart;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const budget: Budget = {
			weekly: Math.max(0, Number.parseFloat(weekly) || 0),
			monthly: Math.max(0, Number.parseFloat(monthly) || 0),
			weekStart,
		};
		await saveBudget(budget);
		saved = true;
		clearTimeout(savedTimer);
		savedTimer = setTimeout(() => (saved = false), 2200);
	}
</script>

<svelte:head><title>Settings — Spend</title></svelte:head>

<main class="standard-page settings-page">
	<h1>Settings</h1>
	<form class="settings-form" onsubmit={submit}>
		<label for="week-start">Week starts on</label>
		<select id="week-start" bind:value={weekStart}>
			{#each weekDays as day, index (day)}<option value={index}>{day}</option>{/each}
		</select>

		<label for="weekly-limit">Weekly limit</label>
		<div class="field-with-prefix">
			<span>$</span><input id="weekly-limit" inputmode="decimal" bind:value={weekly} />
		</div>

		<label for="monthly-limit">Monthly limit</label>
		<div class="field-with-prefix">
			<span>$</span><input id="monthly-limit" inputmode="decimal" bind:value={monthly} />
		</div>

		<div class="settings-actions">
			<span role="status">{saved ? 'Saved' : ''}</span><button class="primary-button" type="submit"
				>Save settings</button
			>
		</div>
	</form>
</main>
