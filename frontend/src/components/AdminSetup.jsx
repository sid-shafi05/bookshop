// src/components/AdminSetup.jsx
//
// Mirrors DeliverymanSetup.jsx, but for the admin invite flow.
// Handles the /register/admin?token=... link sent by POST /admin/admins.
//
// Backend contract (routes/auth.js):
//   GET  /auth/invite/:token          -> { email, role, name } | 404 if invalid/expired
//   POST /auth/invite/:token/accept   -> { username, password } -> { user }

import { useEffect, useState } from 'react';
import { api } from '../api';

export default function AdminSetup() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';

  const [invite, setInvite] = useState(null); // { email, role, name }
  const [checking, setChecking] = useState(true);
  const [inviteError, setInviteError] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | done | error
  const [errorMsg, setErrorMsg] = useState('');

  // Validate the token up front, same as the deliveryman flow should
  // arguably also do — this way a dead/expired link shows a clear message
  // instead of only failing after the person fills out the whole form.
  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }
    api.checkInvite(token)
      .then((data) => {
        if (data.role !== 'admin') {
          setInviteError('This invite link is not for an admin account.');
        } else {
          setInvite(data);
        }
      })
      .catch((err) => {
        setInviteError(err.message || 'This invite link is invalid or has expired.');
      })
      .finally(() => setChecking(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim()) {
      setErrorMsg('Please choose a username.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setStatus('submitting');
    try {
      await api.completeAdminSetup({ token, username: username.trim(), password });
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Failed to complete setup. The link may have expired.');
    }
  };

  if (!token) {
    return (
      <main style={styles.wrapper}>
        <div style={styles.card}>
          <h2>Invalid Link</h2>
          <p>This setup link is missing a token. Please use the link from your invitation email.</p>
        </div>
      </main>
    );
  }

  if (checking) {
    return (
      <main style={styles.wrapper}>
        <div style={styles.card}>
          <p>Checking your invite...</p>
        </div>
      </main>
    );
  }

  if (inviteError) {
    return (
      <main style={styles.wrapper}>
        <div style={styles.card}>
          <h2>Invite Link Invalid</h2>
          <p>{inviteError}</p>
          <p style={{ color: '#8c827a', fontSize: '0.9rem' }}>
            Ask whoever invited you to send a new invite from the admin panel.
          </p>
        </div>
      </main>
    );
  }

  if (status === 'done') {
    return (
      <main style={styles.wrapper}>
        <div style={styles.card}>
          <h2>Account Ready 🎉</h2>
          <p>Your username and password have been set. You can now log in as an admin.</p>
          <a href="/" style={styles.link}>Go to Login</a>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.wrapper}>
      <div style={styles.card}>
        <h2>Complete Your Admin Account</h2>
        <p style={{ color: '#8c827a', fontSize: '0.9rem' }}>
          {invite?.email
            ? <>Set a username and password for <strong>{invite.email}</strong> to activate your BookHarbour admin account.</>
            : 'Set a username and password to activate your BookHarbour admin account.'}
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Choose a password (min. 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            minLength={6}
            required
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={styles.input}
            minLength={6}
            required
          />

          {errorMsg && <p style={styles.error}>{errorMsg}</p>}

          <button type="submit" disabled={status === 'submitting'} style={styles.button}>
            {status === 'submitting' ? 'Setting up...' : 'Activate Account'}
          </button>
        </form>
      </div>
    </main>
  );
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#faf7f2',
    padding: '20px',
  },
  card: {
    background: '#fff',
    borderRadius: '12px',
    padding: '32px',
    maxWidth: '420px',
    width: '100%',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '16px',
  },
  input: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '0.95rem',
  },
  button: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: 'none',
    background: '#2c2420',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '8px',
  },
  error: {
    color: '#c0392b',
    fontSize: '0.85rem',
    margin: 0,
  },
  link: {
    display: 'inline-block',
    marginTop: '16px',
    color: '#2c2420',
    fontWeight: 600,
  },
};