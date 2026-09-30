<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Laravel's enum() maps to varchar plus a CHECK constraint on Postgres
        // and never manages that constraint again, so the new case has to be
        // added by hand before anything can store it.
        $this->replaceModeConstraint(['relay', 'managed', 'capture']);

        Schema::table('webhook_endpoints', function (Blueprint $table) {
            // A receive-only endpoint has nowhere to forward to.
            $table->string('destination_url')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Nothing may stay null once the column goes back to NOT NULL, and a
        // receive-only endpoint has no destination to restore, so it becomes a
        // relay endpoint with an empty destination.
        DB::table('webhook_endpoints')
            ->where('mode', 'capture')
            ->update(['mode' => 'relay', 'destination_url' => '']);

        Schema::table('webhook_endpoints', function (Blueprint $table) {
            $table->string('destination_url')->change();
        });

        $this->replaceModeConstraint(['relay', 'managed']);
    }

    /**
     * @param  list<string>  $modes
     */
    private function replaceModeConstraint(array $modes): void
    {
        $values = implode(', ', array_map(fn (string $mode): string => "'{$mode}'", $modes));

        DB::statement('ALTER TABLE webhook_endpoints DROP CONSTRAINT IF EXISTS webhook_endpoints_mode_check');

        DB::statement(
            'ALTER TABLE webhook_endpoints ADD CONSTRAINT webhook_endpoints_mode_check '.
            "CHECK (mode::text = ANY (ARRAY[{$values}]::text[]))"
        );
    }
};
