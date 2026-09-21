export type Period = 'week' | 'month';

export function getPeriodBounds(anchor: Date, period: Period, weekStart = 1) {
	const start = new Date(anchor);
	start.setHours(0, 0, 0, 0);
	if (period === 'week') {
		const day = start.getDay();
		start.setDate(start.getDate() - ((day - weekStart + 7) % 7));
	} else start.setDate(1);
	const end = new Date(start);
	if (period === 'week') end.setDate(end.getDate() + 7);
	else end.setMonth(end.getMonth() + 1);
	return { start, end };
}

export function formatPeriodLabel(start: Date, end: Date, period: Period) {
	if (period === 'month')
		return start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
	const lastDay = new Date(end);
	lastDay.setDate(lastDay.getDate() - 1);
	const sameMonth = start.getMonth() === lastDay.getMonth();
	const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	const endLabel = lastDay.toLocaleDateString(
		undefined,
		sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' }
	);
	return `${startLabel} – ${endLabel}`;
}

export function formatCurrency(amount: number) {
	return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount);
}
export function isSameDay(value: string, other: Date) {
	const date = new Date(value);
	return (
		date.getFullYear() === other.getFullYear() &&
		date.getMonth() === other.getMonth() &&
		date.getDate() === other.getDate()
	);
}
export function formatCompactDate(value: string, today: boolean) {
	const date = new Date(value);
	const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
	return today
		? `Today, ${time}`
		: `${date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}, ${time}`;
}
