<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';

	let { children } = $props();
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
