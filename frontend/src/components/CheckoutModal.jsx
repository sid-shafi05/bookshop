// src/components/CheckoutModal.jsx
import { useState } from 'react';
import { api } from '../api';

const PAYMENT_METHODS = ['Cash on Delivery', 'Card', 'Mobile Banking (bKash/Nagad)'];

// Two-step flow inside one modal:
//   1. "form"    -> collect shipping address, payment method, optional coupon
//   2. "payment" -> order has been created (status pending/unpaid); mock "Pay Now"
export default function CheckoutModal({ isOpen, onClose, cart, customerId, onOrderPaid }) {
  const [step, setStep] = useState('form');
  const [form, setForm] = useState({
    shipping_house_no: '', shipping_street: '', shipping_city: '',
    shipping_postal_code: '', shipping_country: '', payment_method: PAYMENT_METHODS[0],
    coupon_code: '',
  });
  const [placedOrder, setPlacedOrder] = useState(null);
  const [totals, setTotals] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setStep('form');
    setPlacedOrder(null);
    setTotals(null);
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
      const res = await api.checkout({
        customer_id: customerId,
        payment_method: form.payment_method,
        coupon_code: form.coupon_code.trim() || undefined,
        shipping_house_no: form.shipping_house_no.trim() || undefined,
        shipping_street: form.shipping_street.trim(),
        shipping_city: form.shipping_city.trim(),
        shipping_postal_code: form.shipping_postal_code.trim() || undefined,
        shipping_country: form.shipping_country.trim(),
      });
      setPlacedOrder(res.order);
      setTotals({ subtotal: res.subtotal, discount: res.discount, total: res.total });
      setStep('payment');
    } catch (err) {
      setError(err.message || 'Could not place your order');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayNow = async () => {
    setPaying(true);
    setError('');
    try {
      const updatedOrder = await api.payOrder(placedOrder.order_id);
      onOrderPaid(updatedOrder);
      reset();
    } catch (err) {
      setError(err.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={handleClose}>
      <div className="auth-dialog checkout-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>{step === 'form' ? 'Checkout' : 'Complete Payment'}</h3>
          <button className="close-x" onClick={handleClose}>✕</button>
        </div>

        {error && <p className="checkout-error">{error}</p>}

        {step === 'form' ? (
          <form onSubmit={handlePlaceOrder} className="dialog-form">
            <div className="checkout-summary-row">
              <span>{cart.items ? cart.items.length : 0} item(s)</span>
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
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="input-field">
              <label>Coupon Code (optional)</label>
              <input type="text" placeholder="e.g. WELCOME10" value={form.coupon_code}
                onChange={(e) => setForm({ ...form, coupon_code: e.target.value.toUpperCase() })} />
            </div>

            <button type="submit" className="dialog-submit-btn" disabled={submitting}>
              {submitting ? 'Placing Order…' : 'Place Order'}
            </button>
          </form>
        ) : (
          <div className="dialog-form">
            <p className="checkout-confirm-msg">
              Order <strong>#{placedOrder.order_id}</strong> has been placed and is awaiting payment.
            </p>
            <div className="checkout-summary-row"><span>Subtotal</span><span>Tk {totals.subtotal}</span></div>
            {Number(totals.discount) > 0 && (
              <div className="checkout-summary-row discount-row"><span>Discount</span><span>-Tk {totals.discount}</span></div>
            )}
            <div className="checkout-summary-row total-row"><span>Total Due</span><strong>Tk {totals.total}</strong></div>
            <p className="checkout-payment-hint">Paying via {placedOrder.payment_method || 'your selected method'} (simulated — no real charge will occur).</p>
            <button className="dialog-submit-btn pay-now-btn" onClick={handlePayNow} disabled={paying}>
              {paying ? 'Processing Payment…' : `Pay Now — Tk ${totals.total}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}