<script lang="ts">
	import './layout.css';
	import { afterNavigate } from '$app/navigation';
	import { page, updated } from '$app/state';
	import { onMount } from 'svelte';

	let { children } = $props();

	/**
	 * Ask the browser to re-fetch `service-worker.js`. If the deployment has changed the
	 * new worker installs, calls `skipWaiting()`, claims this page, and the
	 * `controllerchange` handler below reloads into the new version.
	 */
	async function checkForUpdate() {
		if (!('serviceWorker' in navigator)) return;
		try {
			const registration = await navigator.serviceWorker.getRegistration();
			await registration?.update();
		} catch {
			// Being offline is expected; the cached app remains available.
		}
	}

	// Browsers only look for a new worker on full-page navigations, so check on
	// client-side navigations too.
	afterNavigate(() => void checkForUpdate());

	// SvelteKit polls `_app/version.json` (and re-checks when the app regains focus).
	// When it notices a new deployment, fetch the matching service worker right away.
	$effect(() => {
		if (updated.current) void checkForUpdate();
	});

	onMount(() => {
		// Everything lives in IndexedDB. Ask the browser not to evict it under storage
		// pressure; Safari can otherwise clear site data for rarely used sites.
		void navigator.storage?.persist?.().catch(() => {});

		if (!('serviceWorker' in navigator)) return;

		// A home-screen app on iOS is usually resumed rather than relaunched, so no
		// navigation happens. Check for updates whenever it comes back to the foreground.
		function handleVisibilityChange() {
			if (document.visibilityState === 'visible') void checkForUpdate();
		}

		// Reload once a *new* worker takes over a page that was already controlled.
		// The very first install claims the page too, but nothing changed, so no reload.
		let controlled = navigator.serviceWorker.controller !== null;
		let reloading = false;
		function handleControllerChange() {
			if (controlled && !reloading) {
				reloading = true;
				window.location.reload();
			}
			controlled = true;
		}

		document.addEventListener('visibilitychange', handleVisibilityChange);
		navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
		};
	});
</script>

<svelte:head>
	<meta name="theme-color" content="#f5f5f1" media="(prefers-color-scheme: light)" />
	<meta name="theme-color" content="#111512" media="(prefers-color-scheme: dark)" />
</svelte:head>

<div class="site-shell">
	<header class="site-header">
		<a class="wordmark" href="/">Spend</a>
		<nav aria-label="Main navigation">
			<a href="/" aria-current={page.url.pathname === '/' ? 'page' : undefined}>Add</a>
			<a href="/history" aria-current={page.url.pathname === '/history' ? 'page' : undefined}
				>History</a
			>
			<a href="/settings" aria-current={page.url.pathname === '/settings' ? 'page' : undefined}
				>Settings</a
			>
		</nav>
	</header>

	{@render children()}
</div>
