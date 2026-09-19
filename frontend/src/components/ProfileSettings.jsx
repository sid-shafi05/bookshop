// src/components/ProfileSettings.jsx
//
// Self-service profile editor, usable from any of the three dashboards
// (customer Navbar, AdminDashboard, DeliverymanDashboard) — it's always
// just editing the logged-in user's own `users` row via PUT /auth/me.
//
// Props:
//   isOpen        - boolean
//   onClose       - () => void
//   user          - the current user object (id, username, name, email, role,
//                   phone, house_no, street, city, postal_code, country)
//   onUpdated     - (updatedUser) => void, called after a successful save so
//                   the parent can refresh its `user` state / sessionStorage
//
// Requires in src/api.js:
//   updateMyProfile: (fields) => fetch(`${BASE_URL}/auth/me`, {
//     method: 'PUT',
//     headers: { 'Content-Type': 'application/json' },
//     credentials: 'include',
//     body: JSON.stringify(fields),
//   }).then(handleResponse)

import { useEffect, useState } from 'react';
import { api } from '../api';

const FIELDS = [
  { key: 'name', label: 'Full name', type: 'text' },
  { key: 'username', label: 'Username', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'text' },
];

const ADDRESS_FIELDS = [
  { key: 'house_no', label: 'House / Apt No.' },
  { key: 'street', label: 'Street' },
  { key: 'city', label: 'City' },
  { key: 'postal_code', label: 'Postal Code' },
  { key: 'country', label: 'Country' },
];

export default function ProfileSettings({ isOpen, onClose, user, onUpdated }) {
  const [form, setForm] = useState({});
  const [status, setStatus] = useState('idle'); // idle | saving | error
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || '',
      username: user.username || '',
      email: user.email || '',
      phone: user.phone || '',
      house_no: user.house_no || '',
      street: user.street || '',
      city: user.city || '',
      postal_code: user.postal_code || '',
      country: user.country || '',
    });
    setErrorMsg('');
    setSuccessMsg('');
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleChange = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!form.name?.trim()) return setErrorMsg('Name cannot be empty.');
    if (!form.username?.trim()) return setErrorMsg('Username cannot be empty.');
    if (!form.email?.trim()) return setErrorMsg('Email cannot be empty.');

    setStatus('saving');
    try {
      const res = await api.updateMyProfile(form);
      setStatus('idle');
      setSuccessMsg('Profile updated successfully.');
      onUpdated?.(res.user);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Failed to update profile.');
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={{ margin: 0 }}>My Profile</h2>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">×</button>
        </div>

        <p style={styles.roleTag}>Signed in as {user.role}</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Account details</legend>
            {FIELDS.map(({ key, label, type }) => (
              <label key={key} style={styles.label}>
                {label}
                <input
                  type={type}
                  value={form[key] ?? ''}
                  onChange={handleChange(key)}
                  style={styles.input}
                />
              </label>
            ))}
          </fieldset>

          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>
              Default address
              <span style={styles.legendHint}> — used to prefill checkout</span>
            </legend>
            {ADDRESS_FIELDS.map(({ key, label }) => (
              <label key={key} style={styles.label}>
                {label}
                <input
                  type="text"
                  value={form[key] ?? ''}
                  onChange={handleChange(key)}
                  style={styles.input}
                />
              </label>
            ))}
          </fieldset>

          {errorMsg && <p style={styles.error}>{errorMsg}</p>}
          {successMsg && <p style={styles.success}>{successMsg}</p>}

          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.secondaryBtn}>
              Cancel
            </button>
            <button type="submit" disabled={status === 'saving'} style={styles.primaryBtn}>
              {status === 'saving' ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '20px',
  },
  modal: {
    background: '#fff', borderRadius: '12px', padding: '28px',
    maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closeBtn: {
    background: 'none', border: 'none', fontSize: '1.5rem', lineHeight: 1,
    cursor: 'pointer', color: '#8c827a',
  },
  roleTag: { color: '#8c827a', fontSize: '0.85rem', textTransform: 'capitalize', margin: '4px 0 16px' },
  form: { display: 'flex', flexDirection: 'column', gap: '18px' },
  fieldset: { border: '1px solid #eee', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  legend: { padding: '0 6px', fontWeight: 600, fontSize: '0.9rem' },
  legendHint: { fontWeight: 400, color: '#8c827a', fontSize: '0.8rem' },
  label: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', color: '#555' },
  input: { padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.95rem' },
  error: { color: '#c0392b', fontSize: '0.85rem', margin: 0 },
  success: { color: '#2e7d32', fontSize: '0.85rem', margin: 0 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' },
  secondaryBtn: { padding: '10px 16px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer' },
  primaryBtn: { padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#2c2420', color: '#fff', fontWeight: 600, cursor: 'pointer' },
};