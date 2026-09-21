import { self as worker } from '$app/service-worker';
import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { asset, resolve } from '$app/paths';
import type { Path } from '$app/types';

// One cache per deployment. `version` changes on every build, so a new
// service worker always starts from an empty cache and `activate` drops the rest.
const CACHE = `spend-${version}`;

// `$app/manifest` paths are relative to the base path. Resolve them to absolute
// pathnames so they can be matched against `url.pathname` and used as cache keys.
// (Using the raw relative paths breaks the root page: `''` resolves to the
// service worker's own URL rather than `/`.)
const IMMUTABLE: string[] = immutable.map((file) => resolve(file.path as Path));
const STATIC: string[] = assets
	// Never precache OS metadata such as `.DS_Store`; a single 404 would fail `install`.
	.filter((file) => !file.path.split('/').some((segment) => segment.startsWith('.')))
	.map((file) => asset(file.path));
const PAGES: string[] = prerendered.map((page) => resolve(page.path));
const ROOT: string = resolve('');
// SvelteKit's non-immutable runtime files (`_app/version.json`, `_app/env.js`) live here.
const APP_DIR: string = resolve('_app/' as Path);

// Hashed build output and files from `static` are safe to serve cache-first.
const CACHE_FIRST = new Set<string>([...IMMUTABLE, ...STATIC]);

worker.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);

			// The immutable files are content-hashed and must exist for this build to work.
			await cache.addAll(IMMUTABLE);

			// Pages and static files are refetched past the HTTP cache so that a new
			// deployment never precaches stale HTML. They are best-effort: a failure here
			// must not block the new worker from installing, or updates stall forever.
			await Promise.allSettled(
				[...PAGES, ...STATIC].map((path) => cache.add(new Request(path, { cache: 'reload' })))
			);

			// Take over as soon as we are installed rather than waiting for every tab to close.
			await worker.skipWaiting();
		})()
	);
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
			await worker.clients.claim();
		})()
	);
});

worker.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== worker.location.origin) return;

	if (request.mode === 'navigate') {
		event.respondWith(respondToNavigation(event, url));
		return;
	}

	event.respondWith(respondToRequest(event, url));
});

/**
 * HTML is always fetched from the network, bypassing the HTTP cache, so that a
 * deployment shows up on the next launch. The cached copy is only used offline.
 */
async function respondToNavigation(event: FetchEvent, url: URL): Promise<Response> {
	const cache = await caches.open(CACHE);

	try {
		const response = await fetch(event.request, { cache: 'no-store' });
		if (response.ok) {
			event.waitUntil(cache.put(url.pathname, response.clone()));
		}
		return response;
	} catch (error) {
		const cached =
			(await cache.match(url.pathname)) ?? (await cache.match(ROOT, { ignoreSearch: true }));
		if (cached) return cached;
		throw error;
	}
}

/**
 * Build output and static files come from the cache. Everything else is
 * network-first, with the cache as an offline fallback. SvelteKit's own
 * non-immutable files (such as `_app/version.json`, which the client polls to
 * detect new deployments) are deliberately never stored: a cached copy would
 * report the old version forever and hide every redeploy.
 */
async function respondToRequest(event: FetchEvent, url: URL): Promise<Response> {
	const cache = await caches.open(CACHE);

	if (CACHE_FIRST.has(url.pathname)) {
		const cached = await cache.match(url.pathname);
		if (cached) return cached;
	}

	try {
		const response = await fetch(event.request);
		if (response.ok && isCacheable(url, response)) {
			event.waitUntil(cache.put(event.request, response.clone()));
		}
		return response;
	} catch (error) {
		const cached = await cache.match(event.request);
		if (cached) return cached;
		throw error;
	}
}

function isCacheable(url: URL, response: Response): boolean {
	if (url.pathname.startsWith(APP_DIR) && !CACHE_FIRST.has(url.pathname)) return false;
	const cacheControl = response.headers.get('cache-control') ?? '';
	return !/no-store|no-cache/.test(cacheControl);
}
