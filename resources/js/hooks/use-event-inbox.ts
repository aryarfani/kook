import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventFilters, EventsPageProps } from '@/types/event-workspace';

export function useEventInbox(
    initial: EventsPageProps['events'],
    filters: EventFilters,
    version: string | null = null,
) {
    const scope = JSON.stringify(filters);
    const [state, setState] = useState({
        source: initial,
        scope,
        events: initial,
        loading: false,
        error: '',
        revision: 0,
    });

    if (state.source !== initial || state.scope !== scope) {
        setState({
            source: initial,
            scope,
            events: initial,
            loading: false,
            error: '',
            revision: state.revision + 1,
        });
    }

    const { events, loading, error } = state;
    const request = useRef<AbortController | null>(null);
    const reset = useCallback(() => {
        request.current?.abort();
        request.current = null;
        setState((previous) => ({
            ...previous,
            events: previous.source,
            loading: false,
            error: '',
            revision: previous.revision + 1,
        }));
    }, []);
    useEffect(() => {
        return () => {
            request.current?.abort();
            request.current = null;
        };
    }, [initial, scope]);
    const loadMore = useCallback(async () => {
        if (request.current || events.current_page >= events.last_page) {
            return;
        }

        const controller = new AbortController();
        request.current = controller;
        setState((previous) => ({ ...previous, loading: true, error: '' }));
        const query = new URLSearchParams(
            Object.entries(JSON.parse(scope) as EventFilters).filter(
                ([, value]) => value !== '',
            ),
        );
        query.set('page', String(events.current_page + 1));

        try {
            const response = await fetch(`/events?${query}`, {
                signal: controller.signal,
                headers: {
                    'X-Inertia': 'true',
                    ...(version ? { 'X-Inertia-Version': version } : {}),
                    'X-Inertia-Partial-Component': 'events/index',
                    'X-Inertia-Partial-Data': 'events',
                    'X-Requested-With': 'XMLHttpRequest',
                    Accept: 'text/html, application/xhtml+xml',
                },
            });

            if (!response.ok) {
                throw new Error('Could not load events');
            }

            const result = await response.json();

            if (request.current !== controller || controller.signal.aborted) {
                return;
            }

            const next = result.props?.events as
                EventsPageProps['events'] | undefined;

            if (
                !next ||
                !Array.isArray(next.data) ||
                next.current_page !== events.current_page + 1
            ) {
                throw new Error('Invalid event page');
            }

            setState((previous) => {
                if (previous.source !== initial || previous.scope !== scope) {
                    return previous;
                }

                const ids = new Set(previous.events.data.map((row) => row.id));

                return {
                    ...previous,
                    events: {
                        ...next,
                        data: [
                            ...previous.events.data,
                            ...next.data.filter((row) => !ids.has(row.id)),
                        ],
                    },
                };
            });
        } catch {
            if (request.current === controller && !controller.signal.aborted) {
                setState((previous) =>
                    previous.source === initial && previous.scope === scope
                        ? {
                              ...previous,
                              error: 'Could not load more events. Try again.',
                          }
                        : previous,
                );
            }
        } finally {
            if (request.current === controller) {
                request.current = null;
                setState((previous) =>
                    previous.source === initial && previous.scope === scope
                        ? { ...previous, loading: false }
                        : previous,
                );
            }
        }
    }, [events.current_page, events.last_page, scope, initial, version]);

    return {
        events,
        revision: state.revision,
        loading,
        error,
        hasMore: events.current_page < events.last_page,
        loadMore,
        reset,
    };
}
