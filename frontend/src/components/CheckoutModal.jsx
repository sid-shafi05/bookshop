// src/components/CheckoutModal.jsx
import { useState } from 'react';
import { api } from '../api';

const PAYMENT_METHODS = [
  {
    value: 'cash_on_delivery',
    label: 'Cash on Delivery'
  },
  {
    value: 'mock_online',
    label: 'Card / Mobile Banking (simulated)'
  }
];
export default function CheckoutModal({ isOpen, onClose, cart, customerId, onOrderPaid }) {
  const [form, setForm] = useState({
    shipping_house_no: '', shipping_street: '', shipping_city: '',
    shipping_postal_code: '', shipping_country: '', payment_method: 'cash_on_delivery',
    coupon_code: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.shipping_street.trim() || !form.shipping_city.trim() || !form.shipping_country.trim()) {
      setError('Please fill in your street, city, and country.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await api.checkout({
        customer_id: customerId,
        payment_method: form.payment_method,
        coupon_code: form.coupon_code.trim() || undefined,
        shipping_house_no: form.shipping_house_no.trim() || undefined,
        shipping_street: form.shipping_street.trim(),
        shipping_city: form.shipping_city.trim(),
        shipping_postal_code: form.shipping_postal_code.trim() || undefined,
        shipping_country: form.shipping_country.trim(),
      });
      onOrderPaid(response);
      handleClose();
    } catch (err) {
      setError(err.message || 'Could not place your order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={handleClose}>
      <div className="auth-dialog checkout-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Confirm Order</h3>
          <button className="close-x" onClick={handleClose}>✕</button>
        </div>

        {error && <p className="checkout-error">{error}</p>}

        <form onSubmit={handlePlaceOrder} className="dialog-form">
            <div className="checkout-summary-row">
              <span>{cart.items ? cart.items.length : 0} item(s)</span>
              <strong>Tk {cart.cart_subtotal}</strong>
            </div>
            <div className="checkout-summary-row total-row">
              <span>Total before coupon</span>
              <strong>Tk {cart.cart_subtotal}</strong>
            </div>

            <div className="input-field">
              <label>House / Flat No. (optional)</label>
              <input type="text" value={form.shipping_house_no}
                onChange={(e) => setForm({ ...form, shipping_house_no: e.target.value })} />
            </div>
            <div className="input-field">
              <label>Street *</label>
              <input type="text" required value={form.shipping_street}
                onChange={(e) => setForm({ ...form, shipping_street: e.target.value })} />
            </div>
            <div className="input-field-row">
              <div className="input-field">
                <label>City *</label>
                <input type="text" required value={form.shipping_city}
                  onChange={(e) => setForm({ ...form, shipping_city: e.target.value })} />
              </div>
              <div className="input-field">
                <label>Postal Code</label>
                <input type="text" value={form.shipping_postal_code}
                  onChange={(e) => setForm({ ...form, shipping_postal_code: e.target.value })} />
              </div>
            </div>
            <div className="input-field">
              <label>Country *</label>
              <input type="text" required value={form.shipping_country}
                onChange={(e) => setForm({ ...form, shipping_country: e.target.value })} />
            </div>

            <div className="input-field">
              <label>Payment Method</label>
              <select value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            <div className="input-field">
              <label>Coupon Code (optional)</label>
              <input type="text" placeholder="e.g. WELCOME10" value={form.coupon_code}
                onChange={(e) => setForm({ ...form, coupon_code: e.target.value.toUpperCase() })} />
            </div>

            <button type="submit" className="dialog-submit-btn" disabled={submitting}>
              {submitting ? 'Placing Order…' : 'Confirm Order'}
            </button>
          </form>
      </div>
    </div>
  );
}