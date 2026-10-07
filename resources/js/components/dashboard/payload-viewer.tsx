import { Copy01Icon, Tick01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useClipboard } from '@/hooks/use-clipboard';
import { highlightJson } from '@/lib/json-highlight';
import { cn } from '@/lib/utils';

export function PayloadViewer({
    raw,
    expanded = false,
}: {
    raw: string;
    expanded?: boolean;
}) {
    const [copiedText, copy] = useClipboard();
    const [formatted, setFormatted] = useState(true);
    const [wrap, setWrap] = useState(true);
    const segments = useMemo(() => highlightJson(raw), [raw]);
    const lines = useMemo(() => {
        const result: { text: string; className: string }[][] = [[]];

        for (const segment of formatted && segments
            ? segments
            : [{ text: raw, className: '' }]) {
            segment.text.split('\n').forEach((text, index) => {
                if (index > 0) {
                    result.push([]);
                }

                result[result.length - 1].push({
                    text,
                    className: segment.className,
                });
            });
        }

        return result;
    }, [formatted, segments, raw]);
    const content =
        formatted && segments
            ? segments.map((segment, index) => (
                  <span key={index} className={segment.className}>
                      {segment.text}
                  </span>
              ))
            : raw;
    const copyButton = (
        <Button
            type="button"
            variant={expanded ? 'outline' : 'secondary'}
            size={expanded ? 'sm' : 'icon'}
            onClick={() => copy(raw)}
            aria-label="Copy payload"
            className={expanded ? '' : 'absolute top-2 right-2 z-10'}
            data-test="copy-payload-button"
        >
            <HugeiconsIcon
                icon={copiedText === raw ? Tick01Icon : Copy01Icon}
                className="size-4"
            />
            {expanded && (copiedText === raw ? 'Copied' : 'Copy')}
        </Button>
    );

    return (
        <div className={expanded ? 'flex min-h-0 flex-1 flex-col' : 'relative'}>
            {expanded ? (
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-4 border-b border-border px-5 py-2 text-xs text-muted-foreground">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={formatted}
                            disabled={!segments}
                            onChange={(e) => setFormatted(e.target.checked)}
                            className="accent-signal"
                        />
                        Format JSON
                    </label>
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={wrap}
                            onChange={(e) => setWrap(e.target.checked)}
                            className="accent-signal"
                        />
                        Wrap
                    </label>
                    {copyButton}
                </div>
            ) : (
                copyButton
            )}
            <pre
                className={cn(
                    expanded
                        ? 'min-h-0 flex-1 overflow-auto p-5 font-mono text-sm leading-6'
                        : 'max-h-96 overflow-auto rounded-xl bg-muted p-4 pr-14 font-mono text-xs',
                    wrap ? 'break-all whitespace-pre-wrap' : 'whitespace-pre',
                )}
            >
                {expanded
                    ? lines.map((line, index) => (
                          <span
                              key={index}
                              data-line={index + 1}
                              className="relative block min-h-6 pl-10 before:absolute before:left-0 before:w-6 before:text-right before:text-muted-foreground before:content-[attr(data-line)]"
                          >
                              {line.map((segment, part) => (
                                  <span
                                      key={part}
                                      className={segment.className}
                                  >
                                      {segment.text}
                                  </span>
                              ))}
                              {index < lines.length - 1 ? '\n' : ''}
                          </span>
                      ))
                    : content}
            </pre>
        </div>
    );
}
