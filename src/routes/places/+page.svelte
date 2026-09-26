<script lang="ts">
	import { onMount } from 'svelte';
	import { deletePlace, getPlaces, savePlace, type ExpensePosition, type Place } from '#lib/db.ts';
	import { captureCurrentPosition } from '#lib/geolocation.ts';

	let places = $state<Place[]>([]);
	let name = $state('');
	let radius = $state<number | undefined>(75);
	let position = $state<ExpensePosition>();
	let editing = $state<Place>();
	let loading = $state(true);
	let locating = $state(false);
	let saving = $state(false);
	let status = $state('');
	let failed = $state(false);

	onMount(() => {
		void load();
	});

	async function load() {
		try {
			places = await getPlaces();
		} catch {
			setStatus('Could not load saved places.', true);
		} finally {
			loading = false;
		}
	}

	function setStatus(message: string, isFailure = false) {
		status = message;
		failed = isFailure;
	}

	async function locate() {
		locating = true;
		setStatus('Getting your current location…');
		try {
			position = await captureCurrentPosition();
			setStatus(`Location captured with about ${Math.round(position.accuracy)} m accuracy.`);
		} catch (error) {
			const denied =
				typeof error === 'object' && error !== null && 'code' in error && error.code === 1;
			setStatus(
				denied
					? 'Location access was denied. Allow it in your browser settings and try again.'
					: 'Could not get your current location. Try again in a moment.',
				true
			);
		} finally {
			locating = false;
		}
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const parsedRadius = radius;
		if (!name.trim()) {
			setStatus('Enter a name for this place.', true);
			return;
		}
		if (!position) {
			setStatus('Capture your current location before saving.', true);
			return;
		}
		if (
			parsedRadius === undefined ||
			!Number.isFinite(parsedRadius) ||
			parsedRadius < 5 ||
			parsedRadius > 2_000
		) {
			setStatus('Enter a radius from 5 to 2,000 metres.', true);
			return;
		}

		saving = true;
		try {
			const place: Place = {
				id: editing?.id ?? crypto.randomUUID(),
				name: name.trim(),
				latitude: position.latitude,
				longitude: position.longitude,
				radius: parsedRadius,
				createdAt: editing?.createdAt ?? new Date().toISOString(),
			};
			await savePlace(place);
			places = [...places.filter((item) => item.id !== place.id), place].sort((first, second) =>
				first.name.localeCompare(second.name)
			);
			resetForm();
			setStatus(`${place.name} saved.`);
		} catch {
			setStatus('Could not save that place.', true);
		} finally {
			saving = false;
		}
	}

	function editPlace(place: Place) {
		editing = place;
		name = place.name;
		radius = place.radius;
		position = {
			latitude: place.latitude,
			longitude: place.longitude,
			accuracy: 0,
		};
		setStatus('Update the details or capture a new position.');
		document.querySelector<HTMLInputElement>('#place-name')?.focus();
	}

	function resetForm() {
		editing = undefined;
		name = '';
		radius = 75;
		position = undefined;
	}

	async function removePlace(place: Place) {
		if (!window.confirm(`Delete ${place.name}? Existing entries will keep their saved name.`))
			return;
		try {
			await deletePlace(place.id);
			places = places.filter((item) => item.id !== place.id);
			if (editing?.id === place.id) resetForm();
			setStatus(`${place.name} deleted.`);
		} catch {
			setStatus('Could not delete that place.', true);
		}
	}
</script>

<svelte:head>
	<title>Places — Spend</title>
	<meta name="description" content="Name frequently visited purchase locations." />
</svelte:head>

<main class="standard-page places-page">
	<h1>Places</h1>
	<p class="page-intro">
		Name the stores you visit and choose how close you need to be for a match. The closest place
		inside its radius is added to each new entry automatically. New entries also need
		<a href="/settings">location capture enabled</a>.
	</p>

	<section class="place-editor" aria-labelledby="place-editor-title">
		<h2 id="place-editor-title">{editing ? `Edit ${editing.name}` : 'Add a place'}</h2>
		<form class="place-form" onsubmit={submit}>
			<label for="place-name">Place name</label>
			<input
				id="place-name"
				autocomplete="organization"
				bind:value={name}
				placeholder="Store name"
			/>

			<label for="place-radius">Match radius <span>metres</span></label>
			<input
				id="place-radius"
				type="number"
				inputmode="numeric"
				min="5"
				max="2000"
				step="5"
				bind:value={radius}
			/>

			<div class="position-panel">
				{#if position}
					<div>
						<strong>Position ready</strong>
						<small>{position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}</small>
					</div>
				{:else}
					<div>
						<strong>No position yet</strong>
						<small>Capture your location while you are at the store.</small>
					</div>
				{/if}
				<button class="secondary-button" type="button" disabled={locating} onclick={locate}>
					{locating ? 'Locating…' : position ? 'Update position' : 'Use current location'}
				</button>
			</div>

			<div class="place-form-actions">
				{#if editing}
					<button class="secondary-button" type="button" onclick={resetForm}>Cancel</button>
				{/if}
				<button class="primary-button" type="submit" disabled={saving || locating}>
					{saving ? 'Saving…' : editing ? 'Update place' : 'Save place'}
				</button>
			</div>
		</form>
		<p class:error={failed} class="place-status" role="status">{status}</p>
	</section>

	<section class="saved-places" aria-labelledby="saved-places-title">
		<h2 id="saved-places-title">Saved places</h2>
		{#if loading}
			<p class="empty-message">Loading…</p>
		{:else if places.length === 0}
			<p class="empty-message">No places saved yet.</p>
		{:else}
			<div class="place-list">
				{#each places as place (place.id)}
					<article class="place-row">
						<div>
							<strong>{place.name}</strong>
							<small>{place.radius} m radius</small>
						</div>
						<div class="place-row-actions">
							<button type="button" onclick={() => editPlace(place)}>Edit</button>
							<button class="delete-link" type="button" onclick={() => removePlace(place)}>
								Delete
							</button>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>
</main>
