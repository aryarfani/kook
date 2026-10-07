import '../resources/css/app.css';
import { createInertiaApp } from '@inertiajs/react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';

const pages = import.meta.glob('../resources/js/pages/**/*.tsx');
createInertiaApp({
    title: (title) => `${title || 'Kook'} — local preview`,
    resolve: async (name) => {
        if (name === 'preview/unavailable') {
            return import('./unavailable');
        }

        const loader = pages[`../resources/js/pages/${name}.tsx`];

        if (!loader) {
            throw new Error(`Unknown preview page: ${name}`);
        }

        return loader();
    },
    layout: () => AppLayout,
    strictMode: true,
    withApp: (app) => (
        <TooltipProvider delayDuration={0}>
            {app}
            <Toaster />
        </TooltipProvider>
    ),
});
initializeTheme();
