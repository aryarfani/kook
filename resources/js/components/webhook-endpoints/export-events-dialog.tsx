import { Calendar03Icon, Download01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { toUrl } from '@/lib/utils';
import { exportEvents } from '@/routes/webhook-endpoints';
import type { WebhookEndpoint } from '@/types';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
});

/**
 * Format a local date as ISO-8601 *with its offset*, e.g.
 * 2026-09-30T00:00:00.000+07:00.
 *
 * The offset has to survive the trip: the server resolves both bounds to UTC
 * before filtering, and also uses the local date for the download filename.
 * Sending a plain UTC instant would make the filename disagree with the range
 * the user picked.
 */
function toLocalIso(date: Date, endOfDay: boolean): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absolute = Math.abs(offsetMinutes);

    return [
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        endOfDay ? '23:59:59.999' : '00:00:00.000',
        `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`,
    ].join('T');
}

function rangeLabel(range: DateRange | undefined): string {
    if (!range?.from) {
        return 'All time';
    }

    if (!range.to) {
        return `From ${dateFormatter.format(range.from)}`;
    }

    return `${dateFormatter.format(range.from)} – ${dateFormatter.format(range.to)}`;
}

export function ExportEventsDialog({
    webhookEndpoint,
}: {
    webhookEndpoint: WebhookEndpoint;
}) {
    const [open, setOpen] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [range, setRange] = useState<DateRange | undefined>();

    function handleOpenChange(next: boolean) {
        setOpen(next);

        if (!next) {
            setRange(undefined);
            setPickerOpen(false);
        }
    }

    function download() {
        const query: Record<string, string> = {};

        if (range?.from) {
            query.from = toLocalIso(range.from, false);
        }

        if (range?.to) {
            query.to = toLocalIso(range.to, true);
        }

        // A normal navigation is enough: the response carries
        // Content-Disposition: attachment, so the browser downloads it
        // without leaving the page.
        window.location.href = toUrl(exportEvents(webhookEndpoint, { query }));
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button
                    variant="secondary"
                    size="sm"
                    data-test="export-events-button"
                >
                    <HugeiconsIcon icon={Download01Icon} className="size-4" />
                    Download
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>Download events</DialogTitle>
                <DialogDescription>
                    Every event received by "{webhookEndpoint.name}", with its
                    headers, payload and raw body, as a single JSON file. Leave
                    the range empty to export everything.
                </DialogDescription>

                <div className="grid gap-2">
                    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className="w-full justify-start font-normal"
                                data-test="export-events-range-trigger"
                            >
                                <HugeiconsIcon
                                    icon={Calendar03Icon}
                                    className="size-4"
                                />
                                {rangeLabel(range)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="range"
                                selected={range}
                                onSelect={setRange}
                                autoFocus
                                data-test="export-events-calendar"
                            />
                        </PopoverContent>
                    </Popover>

                    {range?.from && (
                        <button
                            type="button"
                            onClick={() => setRange(undefined)}
                            className="w-fit text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                            data-test="export-events-clear-range"
                        >
                            Clear range (export all events)
                        </button>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <DialogClose asChild>
                        <Button variant="secondary">Cancel</Button>
                    </DialogClose>
                    <Button
                        onClick={download}
                        className="bg-signal text-signal-foreground hover:bg-signal/90"
                        data-test="confirm-export-events-button"
                    >
                        <HugeiconsIcon
                            icon={Download01Icon}
                            className="size-4"
                        />
                        Download JSON
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
