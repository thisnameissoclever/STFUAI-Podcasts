import { db } from './db';
import type { UserSession } from '../types';

export const authService = {
    async loginAnonymous(username: string): Promise<UserSession> {
        // Check if session exists
        let session = await db.getSession();

        if (session && session.username === username) {
            return session;
        }

        // Create new session
        session = {
            username,
            isAnonymous: true,
            subscriptions: [],
            queue: [],
            history: [],
        };

        await db.saveSession(session);
        return session;
    },

    async getSession(): Promise<UserSession | undefined> {
        return db.getSession();
    },

    async logout(): Promise<void> {
        // For anonymous, maybe we just clear the session from memory but keep DB?
        // Or clear DB? The prompt says "remembered and saved associated with their anonymous user account".
        // So we shouldn't delete data on logout, just maybe clear current session state if we had one in memory.
        // But since we use DB as source of truth, logout might just mean "forget current user".
        // But we only support one user at a time for now (local app).
        // So logout isn't really defined.
    }
};
