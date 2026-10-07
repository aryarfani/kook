<?php

namespace App\Http\Requests\WebhookEndpoints;

use App\Models\WebhookEndpoint;
use App\Services\Webhooks\EventTitleFormatter;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

class UpdateEventTitleFormatRequest extends FormRequest
{
    public function authorize(): bool
    {
        /** @var WebhookEndpoint $endpoint */
        $endpoint = $this->route('webhook_endpoint');

        return $this->user()?->can('update', $endpoint) ?? false;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return ['event_title_format' => ['present', 'nullable', 'string', 'max:500', function (string $attribute, mixed $value, Closure $fail): void {
            if (! is_string($value) || ! app(EventTitleFormatter::class)->valid($value)) {
                $fail('Use text and {{dot.paths}} with numeric array indexes (maximum 32 fields).');
            }
        }]];
    }
}
