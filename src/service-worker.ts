/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';

const worker = self as unknown as ServiceWorkerGlobalScope;
const cacheName = `spend-${version}`;
const precache = [...immutable, ...assets, ...prerendered].map(({ path }) => path);

worker.addEventListener('install', (event) => {
	event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(precache)));
	worker.skipWaiting();
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			await Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)));
			await worker.clients.claim();
		})
	);
});

worker.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	if (event.request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				const cache = await caches.open(cacheName);
				try {
					const response = await fetch(event.request, { cache: 'no-store' });
					if (response.ok) await cache.put(event.request, response.clone());
					return response;
				} catch (error) {
					const cached = await cache.match(event.request);
					const fallback = await cache.match(new URL('.', worker.location.href).pathname);
					if (cached) return cached;
					if (fallback) return fallback;
					throw error;
				}
			})()
		);
		return;
	}

	event.respondWith(
		caches.match(event.request).then(async (cached) => {
			if (cached) return cached;
			try {
				const response = await fetch(event.request);
				if (response.ok && new URL(event.request.url).origin === worker.location.origin) {
					const cache = await caches.open(cacheName);
					await cache.put(event.request, response.clone());
				}
				return response;
			} catch (error) {
				const fallback = await caches.match(new URL('.', worker.location.href).pathname);
				if (fallback && event.request.mode === 'navigate') return fallback;
				throw error;
			}
		})
	);
});
