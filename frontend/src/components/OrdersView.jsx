// src/components/OrdersView.jsx
import { useEffect, useState, useRef } from 'react';
import { api } from '../api';

export default function OrdersView({ customerId, initialOrderId, onCartChanged, onReviewSubmitted, onClose }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(initialOrderId || null);

  // Full detail (items/delivery/can_review/can_return) is fetched lazily per order,
  // since GET /orders/customer/:id only returns summary rows.
  const [detailCache, setDetailCache] = useState({}); // { [order_id]: { items, delivery, can_review, can_return, return_requests } }
  const [detailLoadingId, setDetailLoadingId] = useState(null);

  const [reviewTarget, setReviewTarget] = useState(null); // { order_id, book_id, title }
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);

  // Return state - checkbox multi-select
  const [returnTarget, setReturnTarget] = useState(null); // { order_id, selectedItems: [{order_item_id, title, quantity, unit_price}] }
  const [returnReason, setReturnReason] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  // Track orders with pending return requests (local state for immediate UI update)
  const [ordersWithPendingReturns, setOrdersWithPendingReturns] = useState(new Set());

  const highlightRef = useRef(null);

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

  const loadDetail = async (orderId) => {
    if (detailCache[orderId]) return; // already fetched
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
          return_requests: data.return_requests || [],
        },
      }));
    } catch (err) {
      setDetailCache((prev) => ({ ...prev, [orderId]: { items: [], error: err.message } }));
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

  // Return badge helpers
  const getReturnBadge = (order) => {
    const detail = detailCache[order.order_id];
    const requests = detail?.return_requests || [];
    const hasAnyReturn = requests.length > 0 || ordersWithPendingReturns.has(order.order_id);
    if (!hasAnyReturn) return null;
    const statuses = requests.map(r => r.status);
    const localPending = ordersWithPendingReturns.has(order.order_id);
    if (localPending) return <span className="order-return-badge">Return Requested</span>;
    if (statuses.includes('approved') || statuses.includes('rejected') || statuses.includes('processed')) {
      return <span className="order-return-badge processed">Return Processed</span>;
    }
    return <span className="order-return-badge">Return Requested</span>;
  };

  const getReturnEligibility = (order) => {
    const detail = detailCache[order.order_id];
    if (!detail) {
      return { allowed: false, message: '' };
    }

    const requests = detail?.return_requests || [];
    const hasActiveReturn = requests.some((request) => ['requested', 'approved', 'processed'].includes(request?.status))
      || ordersWithPendingReturns.has(order.order_id);

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
    const requests = detail?.return_requests || [];
    const hasActiveReturn = requests.some((request) => ['requested', 'approved', 'processed'].includes(request?.status))
      || ordersWithPendingReturns.has(order.order_id);
    return Boolean(detail) && order.status === 'delivered' && order.delivery_status === 'delivered' && !hasActiveReturn && detail.can_return !== false;
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
    if (!returnTarget || returnTarget.selectedItems.length === 0) return;
    setSubmittingReturn(true);
    try {
      const orderItemIds = returnTarget.selectedItems.map(item => item.order_item_id);
      const created = await api.requestReturn(returnTarget.order_id, orderItemIds, returnReason.trim());
      // Update local state to show return requests
      const returnRequests = returnTarget.selectedItems.map((item, idx) => ({
        return_id: created.return_ids[idx],
        order_item_id: item.order_item_id,
        status: 'requested',
        reason: returnReason.trim(),
      }));
      setDetailCache((prev) => ({
        ...prev,
        [returnTarget.order_id]: {
          ...prev[returnTarget.order_id],
          can_return: false,
          return_requests: [...(prev[returnTarget.order_id]?.return_requests || []), ...returnRequests],
        },
      }));
      // Immediately mark order as having pending return
      setOrdersWithPendingReturns(prev => new Set(prev).add(returnTarget.order_id));
      setReturnTarget(null);
      setReturnReason('');
    } catch (err) {
      alert(err.message || 'Failed to submit return request');
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Open return modal for an order - fetches items if not cached
  const openReturnModal = async (order) => {
    // Check if we have detail cached
    const detail = detailCache[order.order_id];
    if (detail && detail.items) {
      setReturnTarget({
        order_id: order.order_id,
        selectedItems: [],
        items: detail.items.map(item => ({
          order_item_id: item.order_item_id,
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unit_price,
        }))
      });
      return;
    }
    // Fetch order detail first
    try {
      const data = await api.getOrderDetail(order.order_id);
      setDetailCache((prev) => ({
        ...prev,
        [order.order_id]: {
          items: data.items || [],
          delivery: data.delivery,
          can_review: data.can_review,
          can_return: data.can_return,
          return_requests: data.return_requests || [],
        },
      }));
      setReturnTarget({
        order_id: order.order_id,
        selectedItems: [],
        items: (data.items || []).map(item => ({
          order_item_id: item.order_item_id,
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unit_price,
        }))
      });
    } catch (err) {
      alert(err.message || 'Failed to load order details');
    }
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
                        {order.payment_status === 'paid' ? 'Paid' : order.payment_status === 'partial_refund' ? 'Partial Refund' : order.payment_status === 'refunded' ? 'Refunded' : 'Unpaid'}
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
                    {detail && order.status === 'delivered' && order.delivery_status === 'delivered' && (
                      <div className="order-return-note">
                        {canShowReturnButton(order) ? (
                          <button
                            className="btn-link-return"
                            onClick={(e) => {
                              e.stopPropagation();
                              openReturnModal(order);
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
                      const hasReturnRequest = detail.return_requests?.some(r => r.order_item_id === item.order_item_id);
                      const returnRequest = detail.return_requests?.find(r => r.order_item_id === item.order_item_id);
                      const isReturnActive = returnTarget?.order_id === order.order_id;
                      const isSelected = returnTarget?.selectedItems?.some(si => si.order_item_id === item.order_item_id);
                      
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
                          {hasReturnRequest && returnRequest && (
                            <span className={`return-status status-${returnRequest.status}`}>
                              Return: {returnRequest.status === 'approved' || returnRequest.status === 'processed' ? 'approved' : returnRequest.status === 'rejected' ? 'rejected' : 'requested'}
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

                    {detail?.return_requests && detail.return_requests.length > 0 && (
                      <div className="return-requests-summary">
                        <p className="order-delivery-note compact-note">
                          One request per order. 10-day delivery window.
                        </p>
                        {detail.return_requests.map(r => (
                          <p key={r.return_id} className="order-delivery-note">
                            Return <strong>{r.status}</strong>: {r.reason}
                          </p>
                        ))}
                      </div>
                    )}

                    {detail && order.status === 'delivered' && order.delivery_status === 'delivered' && returnEligibility.message && (
                      <p className="order-delivery-note compact-note">{returnEligibility.message}</p>
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
              <h4>Request Return for Order #{returnTarget.order_id}</h4>
              <div className="return-items-list">
                {(returnTarget.items || []).map(item => {
                  const isSelected = returnTarget.selectedItems?.some(si => si.order_item_id === item.order_item_id);
                  return (
                    <div key={item.order_item_id} className="return-item-preview">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setReturnTarget(prev => ({
                                ...prev,
                                selectedItems: [...(prev?.selectedItems || []), item]
                              }));
                            } else {
                              setReturnTarget(prev => ({
                                ...prev,
                                selectedItems: prev.selectedItems.filter(si => si.order_item_id !== item.order_item_id)
                              }));
                            }
                          }}
                        />
                        <span>{item.title} × {item.quantity}</span>
                        <span>Tk {Number(item.unit_price * item.quantity).toFixed(2)}</span>
                      </label>
                    </div>
                  );
                })}
              </div>
              {(returnTarget.selectedItems?.length || 0) > 0 && (
                <>
                  <label>
                    Reason for return
                    <textarea
                      required
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="Why are you returning these items?"
                      rows={3}
                    />
                  </label>
                  <div className="admin-form-actions">
                    <button type="submit" className="btn-save" disabled={submittingReturn}>
                      {submittingReturn ? 'Submitting…' : 'Submit Return Request'}
                    </button>
                    <button type="button" className="btn-cancel" onClick={() => setReturnTarget(null)}>Cancel</button>
                  </div>
                </>
              )}
              {(returnTarget.selectedItems?.length || 0) === 0 && (
                <p className="order-delivery-note">Select items to return, then fill reason and submit.</p>
              )}
            </form>
          </div>
        )}
    </main>
  );
}