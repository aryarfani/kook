import { router } from '@inertiajs/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { EventTitleEditor } from './event-title-editor';

vi.mock('@inertiajs/react', () => ({ router: { patch: vi.fn() } }));
const endpoints = [
    {
        id: 'demo-endpoint',
        name: 'WhatsApp demo',
        project_id: 'demo',
        mode: 'capture' as const,
    },
];

test('pasted JSON generates selectable paths and saves only the format', async () => {
    render(<EventTitleEditor endpoints={endpoints} />);
    await userEvent.click(screen.getByRole('button', { name: 'Title format' }));
    await userEvent.click(screen.getByLabelText('Example JSON'));
    await userEvent.paste(
        '{"entry":[{"changes":[{"field":"messages"}]}],"object":"whatsapp_business_account"}',
    );
    await userEvent.click(
        screen.getByRole('button', {
            name: 'Insert entry.0.changes.0.field: messages',
        }),
    );
    await userEvent.click(
        screen.getByRole('button', {
            name: 'Insert object: whatsapp_business_account',
        }),
    );
    expect(
        screen.getByRole('textbox', { name: 'Event title format' }),
    ).toHaveValue('{{entry.0.changes.0.field}} · {{object}}');
    expect(
        screen.getByText('messages · whatsapp_business_account'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save format' }));
    expect(router.patch).toHaveBeenCalledWith(
        '/webhook-endpoints/demo-endpoint/title-format',
        { event_title_format: '{{entry.0.changes.0.field}} · {{object}}' },
        expect.any(Object),
    );
});

test('invalid examples give actionable errors and invalid formats cannot be saved', async () => {
    render(<EventTitleEditor endpoints={endpoints} />);
    await userEvent.click(screen.getByRole('button', { name: 'Title format' }));
    await userEvent.type(screen.getByLabelText('Example JSON'), 'invalid');
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid JSON');
    await userEvent.click(
        screen.getByRole('textbox', { name: 'Event title format' }),
    );
    await userEvent.paste('{{entry[0]}}');
    expect(screen.getByRole('button', { name: 'Save format' })).toBeDisabled();
});
