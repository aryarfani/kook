<?php

namespace App\Services\Webhooks;

class EventTitleFormatter
{
    public function valid(string $format): bool
    {
        if (mb_strlen($format) > 500) {
            return false;
        }
        $count = 0;
        $valid = true;
        $rest = preg_replace_callback('/\{\{([^{}]*)\}\}/', function (array $match) use (&$count, &$valid): string {
            $count++;
            $path = trim($match[1]);
            $valid = $valid && preg_match('/^(?:[A-Za-z_][A-Za-z0-9_-]*|\d+)(?:\.(?:[A-Za-z_][A-Za-z0-9_-]*|\d+))*$/', $path) === 1
                && ! array_intersect(explode('.', $path), ['__proto__', 'prototype', 'constructor']);

            return '';
        }, $format);

        return $valid && $count <= 32 && preg_match('/[{}]/', $rest ?? '') === 0;
    }

    /** @param array<array-key, mixed>|null $payload */
    public function format(?string $format, ?array $payload, ?string $fallback): string
    {
        $default = $fallback !== null && $fallback !== '' ? $fallback : 'Unnamed event';
        if ($format === null || trim($format) === '' || ! $this->valid($format)) {
            return $default;
        }
        $missing = false;
        $title = preg_replace_callback('/\{\{([^{}]*)\}\}/', function (array $match) use ($payload, &$missing): string {
            $value = $payload;
            foreach (explode('.', trim($match[1])) as $key) {
                if (! is_array($value) || ! array_key_exists($key, $value)) {
                    $missing = true;

                    return '';
                }
                $value = $value[$key];
            }
            if (! is_scalar($value) || (is_string($value) && trim($value) === '')) {
                $missing = true;

                return '';
            }

            return is_bool($value) ? ($value ? 'true' : 'false') : (string) $value;
        }, $format);
        $title = trim($title ?? '');

        return $missing || $title === '' ? $default : mb_substr($title, 0, 250);
    }
}
