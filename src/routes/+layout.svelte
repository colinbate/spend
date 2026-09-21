<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';

	let { children } = $props();
</script>


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
