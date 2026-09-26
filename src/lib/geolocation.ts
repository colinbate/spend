import type { ExpensePosition } from '#lib/db.ts';

export function captureCurrentPosition(): Promise<ExpensePosition> {
	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) {
			reject(new Error('Geolocation is not available in this browser.'));
			return;
		}

		navigator.geolocation.getCurrentPosition(
			({ coords }) =>
				resolve({
					latitude: coords.latitude,
					longitude: coords.longitude,
					accuracy: coords.accuracy,
				}),
			reject,
			{ enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
		);
	});
}
