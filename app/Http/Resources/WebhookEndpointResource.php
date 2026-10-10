<?php

namespace App\Http\Resources;

use App\Models\WebhookEndpoint;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin WebhookEndpoint
 */
class WebhookEndpointResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'mode' => $this->mode,
            'destination_urls' => $this->destinations->pluck('url'),
            'status' => $this->status,
            'created_at' => $this->created_at,
        ];
    }
}
