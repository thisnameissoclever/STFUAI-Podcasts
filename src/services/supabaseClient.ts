// src/services/supabaseClient.ts
// Supabase authentication client

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';
import { CLOUD_CONFIG } from '../config/cloud';

export const supabase: SupabaseClient = createClient(
    CLOUD_CONFIG.SUPABASE_URL,
    CLOUD_CONFIG.SUPABASE_ANON_KEY,
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        }
    }
);

export async function signInWithGoogle(): Promise<{ error: Error | null }> {
    try {
        // Generate OAuth URL with PKCE
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: 'stfuai://auth/callback',
                skipBrowserRedirect: true, // Don't redirect in current window
            }
        });

        if (error) {
            return { error: new Error(error.message) };
        }

        if (data?.url) {
            // Open the OAuth URL in the system's default browser
            console.log('[OAuth] Opening external browser for sign-in');
            await window.electronAPI?.openExternal(data.url);
        }

        return { error: null };
    } catch (e) {
        return { error: e instanceof Error ? e : new Error('Sign-in failed') };
    }
}

export async function signOut(): Promise<void> {
    await supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

export async function getAccessToken(): Promise<string | null> {
    const session = await getSession();
    return session?.access_token || null;
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
        callback(session);
    });
}

// Listen for OAuth callback from Electron deep link handler
if (typeof window !== 'undefined' && window.electronAPI?.onAuthCallback) {
    window.electronAPI.onAuthCallback(async (tokens) => {
        console.log('[Supabase] Received OAuth tokens from Electron');
        try {
            // Set the session using the received tokens
            const { data, error } = await supabase.auth.setSession({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token
            });
            if (error) {
                console.error('[Supabase] Failed to set session:', error);
            } else {
                console.log('[Supabase] Session set successfully for user:', data.user?.email);
                // Reload the page to update UI with authenticated state
                window.location.reload();
            }
        } catch (e) {
            console.error('[Supabase] Error setting session:', e);
        }
    });
}
