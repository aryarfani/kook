import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useEventInbox } from '@/hooks/use-event-inbox';
import type { EventsPageProps } from '@/types/event-workspace';

const filters = {
    project: '',
    endpoint: '',
    status: '',
    from: '',
    to: '',
    search: '',
};
function page(ids: string[], current = 1, last = 3): EventsPageProps['events'] {
    return {
        data: ids.map((id) => ({
            id,
            event_name: id,
            status: 'success',
            signature_valid: null,
            latest_delivery: null,
            received_at: '2026-10-07T06:00:00Z',
            project: { id: 'shop', name: 'Shop' },
            endpoint: {
                id: 'one',
                name: 'Endpoint',
                project_id: 'shop',
                mode: 'capture',
            },
        })),
        current_page: current,
        last_page: last,
        total: 5,
        per_page: 2,
        links: [],
    };
}
afterEach(() => vi.unstubAllGlobals());
test('loads the next filtered page once, appends events, and removes duplicate IDs', async () => {
    let resolve!: (value: unknown) => void;
    const fetchPage = vi.fn<
        (url: string, options: RequestInit) => Promise<unknown>
    >(
        () =>
            new Promise((done) => {
                resolve = done;
            }),
    );
    vi.stubGlobal('fetch', fetchPage);
    const initial = page(['a', 'b']);
    const { result } = renderHook(() =>
        useEventInbox(
            initial,
            { ...filters, project: 'shop' },
            'deployed-version',
        ),
    );
    act(() => {
        void result.current.loadMore();
        void result.current.loadMore();
    });
    expect(fetchPage).toHaveBeenCalledOnce();
    expect(fetchPage.mock.calls[0][1].headers).toMatchObject({
        'X-Inertia-Version': 'deployed-version',
    });
    expect(fetchPage.mock.calls[0][0]).toBe('/events?project=shop&page=2');
    await act(async () =>
        resolve({
            ok: true,
            json: async () => ({ props: { events: page(['b', 'c'], 2) } }),
        }),
    );
    await waitFor(() =>
        expect(result.current.events.data.map((row) => row.id)).toEqual([
            'a',
            'b',
            'c',
        ]),
    );
    expect(result.current.hasMore).toBe(true);
});
test('replacing filters discards an in-flight old page and resets the inbox', async () => {
    let resolve!: (value: unknown) => void;
    vi.stubGlobal(
        'fetch',
        () =>
            new Promise((done) => {
                resolve = done;
            }),
    );
    const { result, rerender } = renderHook(
        ({ data, scope }) => useEventInbox(data, scope),
        { initialProps: { data: page(['a', 'b']), scope: filters } },
    );
    act(() => {
        void result.current.loadMore();
    });
    rerender({
        data: page(['new'], 1, 1),
        scope: { ...filters, project: 'new-project' },
    });
    await act(async () =>
        resolve({
            ok: true,
            json: async () => ({ props: { events: page(['old'], 2) } }),
        }),
    );
    expect(result.current.events.data.map((row) => row.id)).toEqual(['new']);
    expect(result.current.hasMore).toBe(false);
});
test('failed loads keep existing events and allow a retry', async () => {
    vi.stubGlobal(
        'fetch',
        vi
            .fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValue({
                ok: true,
                json: async () => ({ props: { events: page(['c'], 2, 2) } }),
            }),
    );
    const initial = page(['a', 'b']);
    const { result } = renderHook(() => useEventInbox(initial, filters));
    await act(async () => {
        await result.current.loadMore();
    });
    expect(result.current.error).toBeTruthy();
    expect(result.current.events.data).toHaveLength(2);
    await act(async () => {
        await result.current.loadMore();
    });
    expect(result.current.error).toBe('');
    expect(result.current.hasMore).toBe(false);
});

test('explicit refresh resets appended rows even when the first page is unchanged', async () => {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ props: { events: page(['c'], 2) } }),
        }),
    );
    const initial = page(['a', 'b']);
    const { result } = renderHook(() => useEventInbox(initial, filters));
    await act(async () => {
        await result.current.loadMore();
    });
    expect(result.current.events.data).toHaveLength(3);
    act(() => result.current.reset());
    expect(result.current.events.data.map((row) => row.id)).toEqual(['a', 'b']);
});
