import type { ExpensePosition, Place } from '#lib/db.ts';

const EARTH_RADIUS_METERS = 6_371_000;

function radians(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

export function distanceInMeters(
	first: Pick<ExpensePosition, 'latitude' | 'longitude'>,
	second: Pick<ExpensePosition, 'latitude' | 'longitude'>
): number {
	const latitudeDelta = radians(second.latitude - first.latitude);
	const longitudeDelta = radians(second.longitude - first.longitude);
	const firstLatitude = radians(first.latitude);
	const secondLatitude = radians(second.latitude);
	const haversine =
		Math.sin(latitudeDelta / 2) ** 2 +
		Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
	return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

export function findMatchingPlace(position: ExpensePosition, places: Place[]): Place | undefined {
	return places
		.map((place) => ({ place, distance: distanceInMeters(position, place) }))
		.filter(({ place, distance }) => distance <= place.radius)
		.sort((first, second) => first.distance - second.distance)[0]?.place;
}
