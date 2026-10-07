const pathPattern =
    /^(?:[A-Za-z_][A-Za-z0-9_-]*|\d+)(?:\.(?:[A-Za-z_][A-Za-z0-9_-]*|\d+))*$/;
const unsafe = new Set(['__proto__', 'prototype', 'constructor']);
const safePath = (path: string) =>
    pathPattern.test(path) && path.split('.').every((key) => !unsafe.has(key));

export function validTitleFormat(format: string): boolean {
    if (format.length > 500) {
        return false;
    }

    let valid = true;
    let count = 0;
    const rest = format.replace(/\{\{([^{}]*)\}\}/g, (_, path: string) => {
        valid = valid && safePath(path.trim());
        count++;

        return '';
    });

    return valid && count <= 32 && !/[{}]/.test(rest);
}

export function formatEventTitle(
    format: string | null | undefined,
    payload: unknown,
    fallback: string | null,
): string {
    const defaultTitle = fallback || 'Unnamed event';

    if (!format?.trim() || !validTitleFormat(format)) {
        return defaultTitle;
    }

    let missing = false;
    const title = format
        .replace(/\{\{([^{}]*)\}\}/g, (_, path: string) => {
            let value: unknown = payload;

            for (const key of path.trim().split('.')) {
                if (
                    value === null ||
                    typeof value !== 'object' ||
                    !Object.hasOwn(value, key)
                ) {
                    missing = true;

                    return '';
                }

                value = (value as Record<string, unknown>)[key];
            }

            if (
                value === null ||
                !['string', 'number', 'boolean'].includes(typeof value) ||
                String(value).trim() === ''
            ) {
                missing = true;

                return '';
            }

            return String(value);
        })
        .trim();

    return missing || !title ? defaultTitle : title.slice(0, 250);
}

export function payloadFields(
    payload: unknown,
): { path: string; value: string }[] {
    const fields: { path: string; value: string }[] = [];
    let visited = 0;
    function visit(value: unknown, path: string, depth: number) {
        if (++visited > 1000 || depth > 12 || fields.length >= 300) {
            return;
        }

        if (value !== null && typeof value === 'object') {
            for (const [key, child] of Object.entries(value)) {
                if (++visited > 1000) {
                    break;
                }

                if (key.includes('.')) {
                    continue;
                }

                const next = path ? `${path}.${key}` : key;

                if (safePath(next)) {
                    visit(child, next, depth + 1);
                }
            }
        } else if (
            value !== null &&
            path &&
            ['string', 'number', 'boolean'].includes(typeof value)
        ) {
            fields.push({ path, value: String(value) });
        }
    }
    visit(payload, '', 0);

    return fields;
}
