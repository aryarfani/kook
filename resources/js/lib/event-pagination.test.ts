import { expect, test } from 'vitest';
import { eventPagination } from '@/lib/event-pagination';
import type { Paginated } from '@/types';

const paginator: Paginated<unknown> = {
    data: [],
    total: 40,
    per_page: 25,
    current_page: 1,
    last_page: 2,
    links: [
        {
            url: 'https://kook.example/events?project=shop&event=old&page=2',
            label: 'Next',
            active: false,
        },
        { url: null, label: 'Previous', active: false },
    ],
};

test('closing the inspector removes the old event from page links', () => {
    expect(eventPagination(paginator).links[0].url).toBe(
        '/events?project=shop&page=2',
    );
    expect(eventPagination(paginator).links[1].url).toBeNull();
});

test('switching the inspector carries the current selection across pagination', () => {
    expect(eventPagination(paginator, 'new').links[0].url).toBe(
        '/events?project=shop&page=2&event=new',
    );
});
