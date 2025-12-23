// src/pages/Login.tsx

import { useState } from 'react';
import { signInWithGoogle } from '../services/supabaseClient';
import './Login.css';

export function Login() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError(null);

        const { error } = await signInWithGoogle();

        if (error) {
            setError(error.message);
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <h1>STFUAI Podcasts</h1>
                <p>Sign in to enable cloud-powered transcription and ad detection.</p>

                <button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="google-signin-btn"
                >
                    {loading ? 'Signing in...' : 'Sign in with Google'}
                </button>

                {error && <p className="error">{error}</p>}
            </div>
        </div>
    );
}
