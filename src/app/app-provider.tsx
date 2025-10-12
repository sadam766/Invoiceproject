'use client';

import { ThemeProvider } from '@/app/components/theme-provider';
import { FirebaseClientProvider } from '@/firebase/client-provider';

export function AppProvider({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <FirebaseClientProvider>
                {children}
            </FirebaseClientProvider>
        </ThemeProvider>
    );
}
