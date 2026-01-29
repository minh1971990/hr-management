import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './AuthPage.css';

type AuthMode = 'login' | 'register';

export function AuthPage() {
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>(
    location.pathname === '/register' ? 'register' : 'login'
  );
  useEffect(() => {
    setMode(location.pathname === '/register' ? 'register' : 'login');
  }, [location.pathname]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      // TODO: Wire to Supabase Auth
      // if (mode === 'login') {
      //   const { error } = await supabase.auth.signInWithPassword({ email, password });
      //   if (error) throw error;
      // } else {
      //   const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
      //   if (error) throw error;
      // }
      // navigate('/dashboard');

      // UI placeholder: simulate success
      await new Promise((r) => setTimeout(r, 600));
      setMessage({ type: 'success', text: mode === 'login' ? 'Login successful.' : 'Check your email to confirm.' });
      if (mode === 'login') {
        setTimeout(() => navigate('/dashboard'), 800);
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Something went wrong.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">HR Candidate Management</h1>
        <p className="auth-subtitle">
          {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                required={mode === 'register'}
                autoComplete="name"
              />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          {message && (
            <div className={`auth-message ${message.type}`}>{message.text}</div>
          )}
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        {mode === 'login' && (
          <p className="auth-footer">
            Don&apos;t have an account?{' '}
            <button type="button" className="link-button" onClick={() => setMode('register')}>
              Register
            </button>
          </p>
        )}
        {mode === 'register' && (
          <p className="auth-footer">
            Already have an account?{' '}
            <button type="button" className="link-button" onClick={() => setMode('login')}>
              Login
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
