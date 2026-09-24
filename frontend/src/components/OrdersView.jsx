// src/components/OrdersView.jsx
import { useEffect, useState, useRef } from 'react';
import { api } from '../api';

export default function OrdersView({ customerId, initialOrderId, onCartChanged, onReviewSubmitted, onClose }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(initialOrderId || null);

  // Full detail (items/delivery/can_review/can_return/return_requests) is fetched lazily per order,
  // since GET /orders/customer/:id only returns summary rows.
  const [detailCache, setDetailCache] = useState({}); // { [order_id]: { items, delivery, can_review, can_return, return_requests } }
  const [detailLoadingId, setDetailLoadingId] = useState(null);

  const [reviewTarget, setReviewTarget] = useState(null); // { order_id, book_id, title }
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);

  const [returnTarget, setReturnTarget] = useState(null); // { order_id }
  const [selectedReturnItemIds, setSelectedReturnItemIds] = useState([]);
  const [returnReason, setReturnReason] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const highlightRef = useRef(null);

  const paymentLabel = (paymentStatus) => paymentStatus === 'partial_refund'
    ? 'Partially refunded'
    : paymentStatus === 'refunded'
      ? 'Refunded'
      : paymentStatus === 'paid'
        ? 'Paid'
        : paymentStatus || 'Unpaid';

  const loadOrders = async () => {
    if (!customerId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getCustomerOrders(customerId);
      const nextOrders = Array.isArray(data) ? data : [];
      setOrders(nextOrders);

      const deliveredIds = nextOrders
        .filter((order) => order.status === 'delivered' && order.delivery_status === 'delivered')
        .map((order) => order.order_id);

      if (deliveredIds.length > 0) {
        const detailResults = await Promise.all(
          deliveredIds.map(async (orderId) => {
            try {
              const detail = await api.getOrderDetail(orderId);
              return { orderId, detail };
            } catch (err) {
              return { orderId, detail: null };
            }
          })
        );

        setDetailCache((prev) => {
          const next = { ...prev };
          for (const result of detailResults) {
            if (!result.detail) continue;
            next[result.orderId] = {
              items: result.detail.items || [],
              delivery: result.detail.delivery,
              can_review: result.detail.can_review,
              can_return: result.detail.can_return,
              return_window_expired: result.detail.return_window_expired,
              return_window_days: result.detail.return_window_days || 10,
              return_requests: result.detail.return_requests || [],
            };
          }
          return next;
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  useEffect(() => {
    if (initialOrderId) {
      setExpandedId(initialOrderId);
      loadDetail(initialOrderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrderId]);

  useEffect(() => {
    if (initialOrderId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [initialOrderId, orders]);

  const loadDetail = async (orderId, force = false) => {
    if (detailCache[orderId] && !force) return; // already fetched
    setDetailLoadingId(orderId);
    try {
      const data = await api.getOrderDetail(orderId);
      setDetailCache((prev) => ({
        ...prev,
        [orderId]: {
          items: data.items || [],
          delivery: data.delivery,
          can_review: data.can_review,
          can_return: data.can_return,
          return_window_expired: data.return_window_expired,
          return_window_days: data.return_window_days || 10,
          return_requests: data.return_requests || [],
        },
      }));
    } catch (err) {
      setDetailCache((prev) => ({ ...prev, [orderId]: { items: [], return_requests: [], error: err.message } }));
    } finally {
      setDetailLoadingId(null);
    }
  };

  const toggleExpand = (orderId) => {
    const next = expandedId === orderId ? null : orderId;
    setExpandedId(next);
    if (next) loadDetail(next);
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Cancel this order?')) return;
    try {
      const updated = await api.cancelOrder(orderId);
      setOrders((prev) => prev.map((o) => (o.order_id === orderId ? { ...o, ...updated } : o)));
      if (onCartChanged) onCartChanged();
    } catch (err) {
      alert(err.message || 'Failed to cancel order');
    }
  };

  const openReviewForm = (orderId, item) => {
    setReviewTarget({ order_id: orderId, book_id: item.book_id, title: item.title });
    setReviewForm({ rating: 5, comment: '' });
  };

  // Return badge helpers — all driven off detail.return_requests (array of return rows)
  const getReturnBadge = (order) => {
    const detail = detailCache[order.order_id];
    const requests = detail?.return_requests || [];
    if (requests.length === 0) return null;

    const hasUnresolved = requests.some((r) => r.status === 'requested');
    if (hasUnresolved) return <span className="order-return-badge">Return Requested</span>;

    const hasResolved = requests.some((r) => ['approved', 'rejected', 'processed'].includes(r.status));
    if (hasResolved) return <span className="order-return-badge processed">Return Processed</span>;

    return null;
  };

  const getReturnEligibility = (order) => {
    const detail = detailCache[order.order_id];
    if (!detail) {
      return { allowed: false, message: '' };
    }

    const requests = detail.return_requests || [];
    const hasActiveReturn = requests.some((r) => r.status !== 'rejected');

    if (order.status !== 'delivered' || order.delivery_status !== 'delivered') {
      return { allowed: false, message: 'Returns are only available for delivered orders.' };
    }

    if (hasActiveReturn) {
      return { allowed: false, message: 'One request per order only.' };
    }

    if (detail.can_return === false) {
      return { allowed: false, message: '10-day window expired.' };
    }

    return { allowed: true, message: 'One request per order. 10-day window.' };
  };

  const canShowReturnButton = (order) => {
    const detail = detailCache[order.order_id];
    if (!detail) return false;
    const requests = detail.return_requests || [];
    const hasActiveReturn = requests.some((r) => r.status !== 'rejected');
    return order.status === 'delivered'
      && order.delivery_status === 'delivered'
      && !hasActiveReturn
      && detail.can_return !== false;
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!reviewTarget) return;
    setSubmittingReview(true);
    try {
      await api.submitReview({
        customer_id: customerId,
        book_id: reviewTarget.book_id,
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment.trim(),
      });
      // mark that item as reviewed locally so the button disappears
      setDetailCache((prev) => {
        const detail = prev[reviewTarget.order_id];
        if (!detail) return prev;
        return {
          ...prev,
          [reviewTarget.order_id]: {
            ...detail,
            items: detail.items.map((it) =>
              it.book_id === reviewTarget.book_id ? { ...it, already_reviewed: true } : it
            ),
          },
        };
      });
      setReviewTarget(null);
      if (onReviewSubmitted) onReviewSubmitted();
    } catch (err) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const submitReturn = async (e) => {
    e.preventDefault();
    if (!returnTarget) return;
    if (selectedReturnItemIds.length === 0) {
      alert('Select at least one book to return');
      return;
    }
    setSubmittingReturn(true);
    try {
      const result = await api.requestReturn(
        returnTarget.order_id,
        returnReason.trim(),
        selectedReturnItemIds
      );
      const newReturnRows = result?.return_requests || [];

      setDetailCache((prev) => ({
        ...prev,
        [returnTarget.order_id]: {
          ...prev[returnTarget.order_id],
          can_return: false,
          return_requests: [...(prev[returnTarget.order_id]?.return_requests || []), ...newReturnRows],
        },
      }));
      setReturnTarget(null);
      setReturnReason('');
      setSelectedReturnItemIds([]);
    } catch (err) {
      alert(err.message || 'Failed to submit return request');
    } finally {
      setSubmittingReturn(false);
    }
  };

  const openReturnForm = (orderId, items) => {
    setReturnTarget({ order_id: orderId });
    setReturnReason('');
    setSelectedReturnItemIds(
      (items || []).filter((item) => !item.return_requested).map((item) => item.order_item_id)
    );
  };

  return (
    <main className="orders-page-wrapper">
      <div className="admin-header-row">
        <h2>My Orders</h2>
        <button className="admin-back-btn" onClick={onClose}>← Back to Shop</button>
      </div>

      <div className="orders-page-body">
          {loading && <div className="empty-state">Loading orders...</div>}
          {!loading && error && <div className="empty-state error-text">{error}</div>}
          {!loading && !error && orders.length === 0 && (
            <div className="empty-state">You haven't placed any orders yet.</div>
          )}

          {!loading && !error && orders.map((order) => {
            const isExpanded = expandedId === order.order_id;
            const isHighlighted = initialOrderId === order.order_id;
            const detail = detailCache[order.order_id];
            const status = (order.status || 'pending').toLowerCase();
            const canCancel = ['pending', 'confirmed'].includes(status);
            const returnEligibility = getReturnEligibility(order);

            return (
              <div
                key={order.order_id}
                ref={isHighlighted ? highlightRef : null}
                className={`order-card${isHighlighted ? ' order-highlighted' : ''}`}
              >
                <div className="order-summary-row" onClick={() => toggleExpand(order.order_id)}>
                  <div>
                    <strong>Order #{order.order_id}</strong>
                    <div className="order-meta">
                      {order.order_date ? new Date(order.order_date).toLocaleDateString() : ''}
                      {' · '}
                      <span className={`order-status status-${status}`}>{order.status || 'Pending'}</span>
                      {' · '}
                      <span className={`order-payment status-${order.payment_status}`}>
                        {paymentLabel(order.payment_status)}
                      </span>
                    </div>
                    <div className="order-meta">
                      {order.item_count} item{Number(order.item_count) === 1 ? '' : 's'}
                      {order.delivery_status ? ` · ${order.delivery_status.replace(/_/g, ' ')}` : ''}
                      {order.tracking_number ? ` · Tracking: ${order.tracking_number}` : ''}
                      {getReturnBadge(order)}
                    </div>
                  </div>
<div className="order-total">
  <span>Tk {Number(order.total_amount ?? 0).toFixed(2)}</span>
  {!isExpanded && detail && order.status === 'delivered' && order.delivery_status === 'delivered' && (
    <div className="order-return-note">
      {canShowReturnButton(order) ? (
        <button
          className="btn-link-return"
          onClick={(e) => {
            e.stopPropagation();
            openReturnForm(order.order_id, detail.items);
          }}
        >
          Request Return
        </button>
      ) : (
        <span>{returnEligibility.message}</span>
      )}
    </div>
  )}
</div>
                </div>

                {isExpanded && (
                  <div className="order-details">
                    {detailLoadingId === order.order_id && <p className="empty-state">Loading items...</p>}

                    {detail && detail.error && (
                      <p className="empty-state error-text">{detail.error}</p>
                    )}

                    {detail && !detail.error && detail.items.length === 0 && (
                      <p className="empty-state">No item details available.</p>
                    )}

                    {detail && !detail.error && detail.items.map((item) => {
                      const returnRequest = (detail.return_requests || []).find(
                        (r) => r.order_item_id === item.order_item_id
                      );

                      return (
                        <div key={item.order_item_id ?? item.book_id} className="order-item-row">
                          <span>{item.title || `Book #${item.book_id}`}</span>
                          <span>× {item.quantity ?? 1}</span>
                          <span>Tk {Number(item.unit_price ?? 0).toFixed(2)}</span>
                          {detail.can_review && !item.already_reviewed && (
                            <button
                              className="btn-link-review"
                              onClick={() => openReviewForm(order.order_id, item)}
                            >
                              Leave a Review
                            </button>
                          )}
                          {item.already_reviewed && <span className="review-done-tag">Reviewed ✓</span>}
                          {returnRequest && (
                            <span className={`return-status status-${returnRequest.status}`}>
                              Return: {returnRequest.status === 'approved' || returnRequest.status === 'processed'
                                ? 'approved'
                                : returnRequest.status === 'rejected'
                                  ? 'rejected'
                                  : 'requested'}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {detail && detail.delivery && (
                      <p className="order-delivery-note">
                        Rider: {detail.delivery.deliveryman_name || '—'}
                        {detail.delivery.deliveryman_phone ? ` (${detail.delivery.deliveryman_phone})` : ''}
                      </p>
                    )}

                    {canCancel && (
                      <button className="btn-danger-outline" onClick={() => handleCancelOrder(order.order_id)}>
                        Cancel Order
                      </button>
                    )}

                    {canShowReturnButton(order) && (
                      <button
                        className="btn-danger-outline"
                        onClick={() => openReturnForm(order.order_id, detail.items)}
                      >
                        Request Return
                      </button>
                    )}

                    {detail && order.status === 'delivered' && order.delivery_status === 'delivered' && returnEligibility.message && (
                      <p className="order-delivery-note compact-note">{returnEligibility.message}</p>
                    )}

                    {detail && status !== 'delivered' && (
                      <p className="order-delivery-note">
                        Returns are available within 10 days after delivery.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

        {reviewTarget && (
          <div className="review-modal-overlay" onClick={() => setReviewTarget(null)}>
            <form className="review-modal" onClick={(e) => e.stopPropagation()} onSubmit={submitReview}>
              <h4>Review: {reviewTarget.title}</h4>
              <label>
                Rating
                <select
                  value={reviewForm.rating}
                  onChange={(e) => setReviewForm({ ...reviewForm, rating: e.target.value })}
                >
                  {[5, 4, 3, 2, 1].map((r) => (
                    <option key={r} value={r}>{r} star{r === 1 ? '' : 's'}</option>
                  ))}
                </select>
              </label>
              <label>
                Comment
                <textarea
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                  placeholder="What did you think of this book?"
                  rows={3}
                />
              </label>
              <div className="admin-form-actions">
                <button type="submit" className="btn-save" disabled={submittingReview}>
                  {submittingReview ? 'Submitting…' : 'Submit Review'}
                </button>
                <button type="button" className="btn-cancel" onClick={() => setReviewTarget(null)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {returnTarget && returnTarget.order_id && (
          <div className="review-modal-overlay" onClick={() => setReturnTarget(null)}>
            <form className="review-modal" onClick={(e) => e.stopPropagation()} onSubmit={submitReturn}>
              <h4>Request Return</h4>
              <p>Select the books you want to return:</p>
              <ul className="return-item-list">
                {(detailCache[returnTarget.order_id]?.items || [])
                  .filter((item) => !item.return_requested)
                  .map((item) => (
                    <li key={item.order_item_id}>
                      <label className="return-item-option">
                        <input
                          type="checkbox"
                          checked={selectedReturnItemIds.includes(item.order_item_id)}
                          onChange={(e) => {
                            setSelectedReturnItemIds((prev) => e.target.checked
                              ? [...prev, item.order_item_id]
                              : prev.filter((id) => id !== item.order_item_id));
                          }}
                        />
                        {item.title || `Book #${item.book_id}`} × {item.quantity ?? 1}
                      </label>
                    </li>
                  ))}
              </ul>
              <label>
                Reason
                <textarea
                  required
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Why are you returning this order?"
                  rows={3}
                />
              </label>
              <div className="admin-form-actions">
                <button type="submit" className="btn-save" disabled={submittingReturn}>
                  {submittingReturn ? 'Submitting…' : 'Submit Return Request'}
                </button>
                <button type="button" className="btn-cancel" onClick={() => setReturnTarget(null)}>Cancel</button>
              </div>
              {selectedReturnItemIds.length === 0 && (
                <p className="order-delivery-note">Select at least one item to return.</p>
              )}
            </form>
          </div>
        )}
    </main>
  );
}