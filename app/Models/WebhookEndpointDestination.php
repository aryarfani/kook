<?php

namespace App\Models;

use Database\Factories\WebhookEndpointDestinationFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $webhook_endpoint_id
 * @property string $url
 * @property int $sort_order
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class WebhookEndpointDestination extends Model
{
    /** @use HasFactory<WebhookEndpointDestinationFactory> */
    use HasFactory, HasUuids;

    protected $fillable = [
        'url',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<WebhookEndpoint, $this>
     */
    public function webhookEndpoint(): BelongsTo
    {
        return $this->belongsTo(WebhookEndpoint::class);
    }
}
