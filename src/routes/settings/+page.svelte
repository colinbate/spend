<script lang="ts">
	import { onMount } from 'svelte';
	import { createBackup, parseBackupJson } from '#lib/backup.ts';
	import { getBudget, getExpenses, restoreBackup, saveBudget, type Budget } from '#lib/db.ts';

	const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	let weekly = $state('200');
	let monthly = $state('800');
	let weekStart = $state(6);
	let saved = $state(false);
	let backupBusy = $state(false);
	let backupStatus = $state('');
	let backupFailed = $state(false);
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

	function setBackupStatus(message: string, failed = false) {
		backupStatus = message;
		backupFailed = failed;
	}

	function chooseBackup() {
		document.querySelector<HTMLInputElement>('#backup-file')?.click();
	}

	async function exportData() {
		backupBusy = true;
		setBackupStatus('');
		try {
			const [expenses, settings] = await Promise.all([getExpenses(), getBudget()]);
			const json = JSON.stringify(createBackup(expenses, settings), null, 2);
			const filename = `spend-backup-${new Date().toISOString().slice(0, 10)}.json`;
			const file = new File([json], filename, { type: 'application/json' });

			if (navigator.canShare?.({ files: [file] })) {
				await navigator.share({ files: [file], title: 'Spend backup' });
				setBackupStatus(
					`Exported ${expenses.length} ${expenses.length === 1 ? 'entry' : 'entries'}.`
				);
			} else {
				const url = URL.createObjectURL(file);
				const link = document.createElement('a');
				link.href = url;
				link.download = filename;
				link.click();
				setTimeout(() => URL.revokeObjectURL(url), 0);
				setBackupStatus(
					`Downloaded ${expenses.length} ${expenses.length === 1 ? 'entry' : 'entries'}.`
				);
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			setBackupStatus('Could not export your data.', true);
		} finally {
			backupBusy = false;
		}
	}

	async function importData(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		backupBusy = true;
		setBackupStatus('');
		try {
			if (file.size > 10_000_000) throw new Error('That backup file is too large.');
			const backup = parseBackupJson(await file.text());
			await restoreBackup(backup.expenses, backup.settings);
			weekly = backup.settings.weekly.toString();
			monthly = backup.settings.monthly.toString();
			weekStart = backup.settings.weekStart;
			setBackupStatus(
				`Imported ${backup.expenses.length} ${backup.expenses.length === 1 ? 'entry' : 'entries'}.`
			);
		} catch (error) {
			setBackupStatus(
				error instanceof Error ? error.message : 'Could not import that backup.',
				true
			);
		} finally {
			input.value = '';
			backupBusy = false;
		}
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

	<section class="backup-section">
		<h2>Backup</h2>
		<p>Export all entries and settings. Importing merges entries by ID and restores settings.</p>
		<div class="backup-actions">
			<button class="secondary-button" type="button" disabled={backupBusy} onclick={exportData}
				>Export JSON</button
			>
			<button class="secondary-button" type="button" disabled={backupBusy} onclick={chooseBackup}
				>Import JSON</button
			>
			<input
				id="backup-file"
				class="sr-only"
				type="file"
				accept="application/json,.json"
				onchange={importData}
			/>
		</div>
		<p class:error={backupFailed} class="backup-status" role="status">{backupStatus}</p>
	</section>
</main>
