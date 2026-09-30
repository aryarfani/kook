import { RefreshIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Form } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { replay } from '@/routes/webhook-events';
import type { WebhookEventDetail } from '@/types';

/**
 * Replays are only offered for events that were successfully verified; the
 * caller decides that, since a receive-only endpoint has nothing to forward.
 */
export function ReplayEventButton({ event }: { event: WebhookEventDetail }) {
    return (
        <Form {...replay.form(event)} options={{ preserveScroll: true }}>
            {({ processing }) => (
                <Button
                    type="submit"
                    variant="secondary"
                    disabled={processing}
                    data-test="replay-event-button"
                >
                    <HugeiconsIcon icon={RefreshIcon} className="size-4" />
                    Replay
                </Button>
            )}
        </Form>
    );
}
