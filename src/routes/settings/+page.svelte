<script lang="ts">
	import { onMount } from 'svelte';
	import { createBackup, parseBackupJson } from '#lib/backup.ts';
	import {
		getBudget,
		getExpenses,
		getPlaces,
		restoreBackup,
		saveBudget,
		type Budget,
	} from '#lib/db.ts';
	import { captureCurrentPosition } from '#lib/geolocation.ts';

	const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	let weekly = $state('200');
	let monthly = $state('800');
	let weekStart = $state(6);
	let captureLocation = $state(false);
	let locationBusy = $state(false);
	let locationStatus = $state('');
	let locationFailed = $state(false);
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
		captureLocation = budget.captureLocation;
		locationStatus = captureLocation
			? 'Location will be captured when you add an entry.'
			: 'Location is not being captured.';
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const budget: Budget = {
			weekly: Math.max(0, Number.parseFloat(weekly) || 0),
			monthly: Math.max(0, Number.parseFloat(monthly) || 0),
			weekStart,
			captureLocation,
		};
		await saveBudget(budget);
		saved = true;
		clearTimeout(savedTimer);
		savedTimer = setTimeout(() => (saved = false), 2200);
	}

	async function enableLocation() {
		locationBusy = true;
		locationFailed = false;
		locationStatus = 'Requesting your current location…';
		try {
			const position = await captureCurrentPosition();
			captureLocation = true;
			const budget = await getBudget();
			await saveBudget({ ...budget, captureLocation: true });
			locationStatus = `Enabled · current accuracy is about ${Math.round(position.accuracy)} m.`;
		} catch (error) {
			locationFailed = true;
			const denied =
				typeof error === 'object' && error !== null && 'code' in error && error.code === 1;
			locationStatus = denied
				? 'Location access was denied. Allow it in your browser settings and try again.'
				: 'Could not get your location. Check your connection and try again.';
		} finally {
			locationBusy = false;
		}
	}

	async function disableLocation() {
		locationBusy = true;
		try {
			captureLocation = false;
			const budget = await getBudget();
			await saveBudget({ ...budget, captureLocation: false });
			locationStatus = 'Location is not being captured.';
			locationFailed = false;
		} finally {
			locationBusy = false;
		}
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
			const [expenses, settings, places] = await Promise.all([
				getExpenses(),
				getBudget(),
				getPlaces(),
			]);
			const json = JSON.stringify(createBackup(expenses, settings, places), null, 2);
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
			await restoreBackup(backup.expenses, backup.settings, backup.places);
			weekly = backup.settings.weekly.toString();
			monthly = backup.settings.monthly.toString();
			weekStart = backup.settings.weekStart;
			captureLocation = backup.settings.captureLocation;
			locationStatus = captureLocation
				? 'Location will be captured when you add an entry.'
				: 'Location is not being captured.';
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

	<section class="settings-section location-section">
		<h2>Location</h2>
		<p>
			Save your coordinates and their accuracy with each new entry. This information stays in this
			app unless you export a backup.
		</p>
		<div class="location-actions">
			{#if captureLocation}
				<button
					class="secondary-button"
					type="button"
					disabled={locationBusy}
					onclick={disableLocation}>Turn off location</button
				>
			{:else}
				<button
					class="primary-button"
					type="button"
					disabled={locationBusy}
					onclick={enableLocation}>{locationBusy ? 'Requesting…' : 'Allow location'}</button
				>
			{/if}
		</div>
		<p class:error={locationFailed} class="location-status" role="status">{locationStatus}</p>
	</section>

	<section class="settings-section backup-section">
		<h2>Backup</h2>
		<p>
			Export all entries, places, and settings. Importing merges entries and places by ID and
			restores settings.
		</p>
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
