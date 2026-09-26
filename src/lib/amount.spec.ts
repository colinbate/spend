import { describe, expect, it } from 'vitest';
import { centsDigits, centsToAmount, formatCentsInput } from './amount';

describe('cents-first amount entry', () => {
	it('formats typed digits as dollars and cents', () => {
		expect(formatCentsInput('1')).toBe('0.01');
		expect(formatCentsInput('10')).toBe('0.10');
		expect(formatCentsInput('1099')).toBe('10.99');
	});

	it('accepts pasted currency text', () => {
		expect(centsDigits('$10.99')).toBe('1099');
		expect(centsToAmount(centsDigits('$10.99'))).toBe(10.99);
	});

	it('keeps an empty input empty and rejects zero', () => {
		expect(formatCentsInput('')).toBe('');
		expect(centsToAmount('')).toBeNull();
		expect(centsToAmount('0')).toBeNull();
	});
});
