import { expect, test } from 'vitest';
import {
    formatEventTitle,
    payloadFields,
    validTitleFormat,
} from './event-title';

const payload = {
    object: 'whatsapp_business_account',
    entry: [
        {
            changes: [
                {
                    field: 'messages',
                    value: { statuses: [{ status: 'read' }] },
                },
            ],
        },
    ],
};

test('formats nested array fields and literals', () => {
    expect(
        formatEventTitle(
            '{{entry.0.changes.0.field}} · {{entry.0.changes.0.value.statuses.0.status}}',
            payload,
            'detected',
        ),
    ).toBe('messages · read');
});
test('missing or complex fields use the detected name, then unnamed fallback', () => {
    expect(formatEventTitle('{{missing}}', payload, 'detected')).toBe(
        'detected',
    );
    expect(formatEventTitle('{{entry}}', payload, null)).toBe('Unnamed event');
    expect(formatEventTitle('{{constructor}}', {}, null)).toBe('Unnamed event');
    expect(formatEventTitle('{{a}}/{{b}}', { a: 0, b: false }, null)).toBe(
        '0/false',
    );
});
test('field picker produces selectable scalar paths and rejects unsafe syntax', () => {
    expect(payloadFields(payload)).toContainEqual({
        path: 'entry.0.changes.0.field',
        value: 'messages',
    });
    expect(
        payloadFields(
            JSON.parse('{"__proto__":"bad","a.b":"ambiguous","safe":"ok"}'),
        ),
    ).toEqual([{ path: 'safe', value: 'ok' }]);
    expect(validTitleFormat('{{entry.0.changes.0.field}}')).toBe(true);
    expect(validTitleFormat('{{entry[0]}}')).toBe(false);
    expect(validTitleFormat('{{object')).toBe(false);
});
