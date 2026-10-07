import { describe, expect, test } from 'vitest';
import { relayStatus } from '@/lib/relay-status';

describe('relay status', () => {
    test('capture always says Receive Only', () => {
        expect(relayStatus('capture', 'success', null)).toBe('Receive Only');
    });
    test('uses delivery outcome instead of successful ingestion', () => {
        expect(
            relayStatus('relay', 'success', {
                status: 'retrying',
                http_status_code: 502,
            }),
        ).toBe('Retrying · HTTP 502');
        expect(
            relayStatus('managed', 'success', {
                status: 'delivered',
                http_status_code: 200,
            }),
        ).toBe('Delivered · HTTP 200');
    });
    test('distinguishes blocked forwarding from queued delivery', () => {
        expect(relayStatus('managed', 'failed', null)).toBe('Not relayed');
        expect(relayStatus('relay', 'success', null)).toBe('Queued');
        expect(
            relayStatus('relay', 'success', {
                status: 'pending',
                http_status_code: null,
            }),
        ).toBe('Queued');
    });
});
