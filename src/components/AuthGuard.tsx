// src/components/AuthGuard.tsx

import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSession, onAuthStateChange } from '../services/supabaseClient';
import { Login } from '../pages/Login';

interface AuthGuardProps {
    children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getSession().then(setSession).finally(() => setLoading(false));

        const { data: { subscription } } = onAuthStateChange(setSession);
        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return <div className="loading-screen">Loading...</div>;
    }

    if (!session) {
        return <Login />;
    }

    return <>{children}</>;
}
