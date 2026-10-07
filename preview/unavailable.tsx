import { Head, Link } from '@inertiajs/react';

export default function Unavailable({ message }: { message: string }) {
    return (
        <>
            <Head title="Local preview" />
            <div className="space-y-4 p-6">
                <h1 className="text-2xl font-semibold">Local preview</h1>
                <p className="text-muted-foreground">{message}</p>
                <Link href="/events" className="text-signal underline">
                    Return to events
                </Link>
            </div>
        </>
    );
}
