import type { Paginated } from '@/types';

export function eventPagination<T>(
    paginator: Paginated<T>,
    selectedId?: string,
): Paginated<T> {
    return {
        ...paginator,
        links: paginator.links.map((link) => {
            if (link.url === null) {
                return link;
            }

            const url = new URL(link.url, 'http://localhost');
            url.searchParams.delete('event');

            if (selectedId) {
                url.searchParams.set('event', selectedId);
            }

            return { ...link, url: `${url.pathname}${url.search}` };
        }),
    };
}
