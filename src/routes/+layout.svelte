<script lang="ts">
	import './layout.css';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	let { children } = $props();
	let reloading = false;

	afterNavigate(() => {
		if ('serviceWorker' in navigator) {
			void navigator.serviceWorker.ready
				.then((registration) => registration.update())
				.catch(() => {
					// Being offline is expected; the cached app remains available.
				});
		}
	});

	onMount(() => {
		if (!('serviceWorker' in navigator)) return;
		const wasControlled = navigator.serviceWorker.controller !== null;

		function handleControllerChange() {
			if (wasControlled && !reloading) {
				reloading = true;
				window.location.reload();
			}
		}

		navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
		return () => {
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
