export function centsDigits(value: string): string {
	const digits = value.replace(/\D/g, '');
	return digits.replace(/^0+(?=\d)/, '');
}

export function formatCentsInput(value: string): string {
	if (!value) return '';
	return (Number.parseInt(value, 10) / 100).toFixed(2);
}

export function centsToAmount(value: string): number | null {
	if (!value) return null;
	const cents = Number.parseInt(value, 10);
	return Number.isSafeInteger(cents) && cents > 0 ? cents / 100 : null;
}
