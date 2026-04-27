'use client';

import { ThemeProvider } from '@/app/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';

export function AppProvider({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <TooltipProvider delayDuration={500}>
                {children}
            </TooltipProvider>
        </ThemeProvider>
    );
}
