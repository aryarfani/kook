<?php

namespace App\Concerns;

use App\Enums\WebhookEndpointMode;
use App\Models\WebhookEndpoint;
use App\Rules\PublicHttpUrl;
use Illuminate\Validation\Rule;

trait WebhookEndpointValidationRules
{
    /**
     * @return array<int, mixed>
     */
    protected function endpointNameRules(): array
    {
        return ['required', 'string', 'max:255'];
    }

    /**
     * Relay and managed endpoints both have somewhere to forward to; only a
     * receive-only endpoint may leave the destination list empty. Every URL
     * is checked against the SSRF guard on its own.
     *
     * @return array<string, array<int, mixed>>
     */
    protected function destinationUrlRules(): array
    {
        return [
            'destination_urls' => [
                'nullable',
                'array',
                'required_unless:mode,capture',
            ],
            'destination_urls.*' => ['required', 'string', 'max:2048', 'distinct', new PublicHttpUrl],
        ];
    }

    /**
     * @return array<int, mixed>
     */
    protected function modeRules(): array
    {
        return ['required', Rule::enum(WebhookEndpointMode::class)];
    }

    /**
     * @return array<int, mixed>
     */
    protected function providerIdRules(): array
    {
        return ['nullable', 'required_if:mode,managed', 'uuid', 'exists:providers,id'];
    }

    /**
     * @return array<int, mixed>
     */
    protected function providerSecretRules(): array
    {
        return ['nullable', 'required_if:mode,managed', 'string', 'max:1024'];
    }

    /**
     * Optional on update: a blank value means "keep the current secret", since
     * the existing value is never redisplayed for the user to re-paste. The
     * exception is moving an endpoint to managed with nothing on file yet,
     * which would leave it with nothing to verify incoming signatures against.
     *
     * @return array<int, mixed>
     */
    protected function providerSecretUpdateRules(): array
    {
        return [
            'nullable',
            Rule::requiredIf(fn (): bool => $this->resolvesToManagedMode() && $this->storedProviderSecret() === null),
            'string',
            'max:1024',
        ];
    }

    private function resolvesToManagedMode(): bool
    {
        $mode = $this->input('mode');

        if (is_string($mode)) {
            return $mode === WebhookEndpointMode::Managed->value;
        }

        $endpoint = $this->route('webhook_endpoint');

        return $endpoint instanceof WebhookEndpoint
            && $endpoint->mode === WebhookEndpointMode::Managed;
    }

    private function storedProviderSecret(): ?string
    {
        $endpoint = $this->route('webhook_endpoint');

        return $endpoint instanceof WebhookEndpoint ? $endpoint->provider_secret : null;
    }
}
