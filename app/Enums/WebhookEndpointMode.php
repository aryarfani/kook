<?php

namespace App\Enums;

enum WebhookEndpointMode: string
{
    case Relay = 'relay';
    case Managed = 'managed';
    // Stores every event as it arrives and never forwards it anywhere.
    case Capture = 'capture';
}
