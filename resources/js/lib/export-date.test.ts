import { afterEach, describe, expect, test, vi } from 'vitest';
import { toLocalIso } from '@/lib/export-date';

afterEach(() => vi.restoreAllMocks());

describe('export calendar dates', () => {
    test('a Jakarta day produces valid ISO bounds for the correct UTC window', () => {
        const date = new Date(2026, 9, 7);
        vi.spyOn(date, 'getTimezoneOffset').mockReturnValue(-420);

        const from = toLocalIso(date, false);
        const to = toLocalIso(date, true);

        expect(from).toBe('2026-10-07T00:00:00.000+07:00');
        expect(to).toBe('2026-10-07T23:59:59.999+07:00');
        expect(new Date(from).toISOString()).toBe('2026-10-06T17:00:00.000Z');
        expect(new Date(to).toISOString()).toBe('2026-10-07T16:59:59.999Z');
    });

    test.each([
        [0, '2026-10-07T00:00:00.000+00:00'],
        [210, '2026-10-07T00:00:00.000-03:30'],
        [-345, '2026-10-07T00:00:00.000+05:45'],
    ])('formats timezone offset %i', (offset, expected) => {
        const date = new Date(2026, 9, 7);
        vi.spyOn(date, 'getTimezoneOffset').mockReturnValue(offset);

        expect(toLocalIso(date, false)).toBe(expected);
    });
});
