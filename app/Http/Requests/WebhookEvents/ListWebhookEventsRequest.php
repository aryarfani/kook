<?php

namespace App\Http\Requests\WebhookEvents;

use App\Enums\WebhookEventStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListWebhookEventsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, array<mixed>>
     */
    public function rules(): array
    {
        $timestamp = ['nullable', 'string', 'date', 'regex:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/'];

        return [
            'project' => ['nullable', 'uuid'],
            'endpoint' => ['nullable', 'uuid'],
            'status' => ['nullable', Rule::enum(WebhookEventStatus::class)],
            'from' => $timestamp,
            'to' => [...$timestamp, Rule::when($this->filled('from'), ['after_or_equal:from'])],
            'event' => ['nullable', 'uuid'],
        ];
    }

    /**
     * @return array{project: string, endpoint: string, status: string, from: string, to: string}
     */
    public function filters(): array
    {
        return [
            'project' => (string) $this->validated('project', ''),
            'endpoint' => (string) $this->validated('endpoint', ''),
            'status' => (string) $this->validated('status', ''),
            'from' => (string) $this->validated('from', ''),
            'to' => (string) $this->validated('to', ''),
        ];
    }
}
