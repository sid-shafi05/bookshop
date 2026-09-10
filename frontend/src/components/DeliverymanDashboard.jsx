import { useState, useEffect, Fragment } from 'react';
import { api } from '../api';
import './AdminDashboard.css';
import NotificationBell from './NotificationBell';
const ACTIVE_STATUSES = ['picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed'];

function formatAddress(o) {
  return (
    [o.shipping_house_no, o.shipping_street, o.shipping_city, o.shipping_country]
      .filter(Boolean)
      .join(', ') || 'No address on file'
  );
}

function mapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default function DeliverymanDashboard({ onClose, user }) {
  const [activeTab, setActiveTab] = useState('requests'); // requests | active | history

  return (
    <main className="admin-wrapper">
      <div className="admin-header-row">
        <h2>Delivery Dashboard</h2>
        <div className="admin-profile-actions">
           <NotificationBell user={user} />
          <div className="admin-profile">
            <strong>{user?.username}</strong>
            <span>{user?.email}</span>
            <small>DELIVERYMAN</small>
          </div>
          <button className="admin-back-btn" onClick={onClose}>Sign Out</button>
        </div>
      </div>

      <div className="admin-tabs">
        <TabButton label="New Requests" active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} />
        <TabButton label="Active Deliveries" active={activeTab === 'active'} onClick={() => setActiveTab('active')} />
        <TabButton label="History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
      </div>

      <div className="admin-panel">
        {activeTab === 'requests' && <RequestsTab />}
        {activeTab === 'active' && <ActiveDeliveriesTab />}
        {activeTab === 'history' && <HistoryTab />}
      </div>
    </main>
  );
}

function TabButton({ label, active, onClick }) {
  return (
    <button className={`admin-tab-btn ${active ? 'active' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}

function RequestsTab() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.getDeliveryRequests();
      setRequests(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const accept = async (id) => {
    setBusyId(id);
    try {
      await api.acceptDelivery(id);
      await load();
    } catch (err) {
      alert(err.message || 'Failed to accept request.');
    } finally {
      setBusyId(null);
    }
  };

  const decline = async (id) => {
    if (!window.confirm('Decline this delivery request?')) return;
    setBusyId(id);
    try {
      await api.declineDelivery(id);
      await load();
    } catch (err) {
      alert(err.message || 'Failed to decline request.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <p className="admin-state-msg">Loading requests...</p>;
  if (error) return <p className="admin-state-msg error">{error}</p>;
  if (requests.length === 0) return <p className="admin-state-msg">No new delivery requests right now.</p>;

  return (
    <div>
      <div className="admin-panel-toolbar">
        <h3>New Requests ({requests.length})</h3>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Address</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.delivery_id}>
              <td>#{r.order_id}</td>
              <td>{r.customer_name}</td>
              <td>Tk {Number(r.total_amount).toFixed(2)}</td>
              <td>{formatAddress(r)}</td>
              <td>
                <div className="admin-actions-cell">
                  <button className="admin-icon-btn" disabled={busyId === r.delivery_id} onClick={() => accept(r.delivery_id)}>
                    Accept
                  </button>
                  <button className="admin-icon-btn danger" disabled={busyId === r.delivery_id} onClick={() => decline(r.delivery_id)}>
                    Decline
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActiveDeliveriesTab() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [detailCache, setDetailCache] = useState({});

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.getMyActiveDeliveries();
      setDeliveries(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load deliveries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleDetail = async (id) => {
    if (expandedId === id) return setExpandedId(null);
    setExpandedId(id);

    if (detailCache[id]) return;
    try {
      const detail = await api.getMyDeliveryDetail(id);
      setDetailCache((prev) => ({ ...prev, [id]: detail }));
    } catch (err) {
      setDetailCache((prev) => ({ ...prev, [id]: { error: err.message } }));
    }
  };

  const advance = async (id, status) => {
    try {
      await api.updateMyDeliveryStatus(id, status);
      await load();
    } catch (err) {
      alert(err.message || 'Failed to update status.');
    }
  };

  if (loading) return <p className="admin-state-msg">Loading deliveries...</p>;
  if (error) return <p className="admin-state-msg error">{error}</p>;
  if (deliveries.length === 0) return <p className="admin-state-msg">No active deliveries.</p>;

  return (
    <div>
      <div className="admin-panel-toolbar">
        <h3>Active Deliveries ({deliveries.length})</h3>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Address / Map</th>
            <th>Update</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((d) => (
            <Fragment key={d.delivery_id}>
              <tr className="admin-order-row" onClick={() => toggleDetail(d.delivery_id)}>
                <td>#{d.order_id}</td>
                <td>{d.customer_name}</td>
                <td>
                  <span className="admin-status-select" style={{ display: 'inline-block', cursor: 'default' }}>
                    {String(d.delivery_status || '').replace(/_/g, ' ')}
                  </span>
                </td>
                <td>
                  {formatAddress(d)}{' '}
                  <a href={mapsUrl(formatAddress(d))} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                    Open in Maps
                  </a>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <select
                    className="admin-status-select"
                    value=""
                    onChange={(e) => e.target.value && advance(d.delivery_id, e.target.value)}
                  >
                    <option value="" disabled>Mark as...</option>
                    {ACTIVE_STATUSES.filter((s) => s !== d.delivery_status).map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </td>
              </tr>

              {expandedId === d.delivery_id && (
                <tr>
                  <td colSpan={5} className="admin-order-detail-cell" onClick={(e) => e.stopPropagation()}>
                    {!detailCache[d.delivery_id] && <p>Loading...</p>}
                    {detailCache[d.delivery_id]?.error && (
                      <p className="admin-state-msg error">{detailCache[d.delivery_id].error}</p>
                    )}
                    {detailCache[d.delivery_id] && !detailCache[d.delivery_id].error && (
                      <div className="admin-order-detail">
                        <p>
                          <strong>Customer:</strong> {detailCache[d.delivery_id].delivery.customer_name}{' '}
                          ({detailCache[d.delivery_id].delivery.customer_email})
                        </p>
                        <p>
                          <strong>Payment:</strong> {detailCache[d.delivery_id].delivery.payment_method} ·{' '}
                          {detailCache[d.delivery_id].delivery.payment_status}
                        </p>
                        <h4>Items</h4>
                        {detailCache[d.delivery_id].items.map((item) => (
                          <div className="admin-order-item" key={item.order_item_id}>
                            <span>{item.title}</span>
                            <span>× {item.quantity}</span>
                            <span>Tk {Number(item.unit_price).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTab() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getMyDeliveryHistory()
      .then((rows) => setHistory(Array.isArray(rows) ? rows : []))
      .catch((err) => setError(err.message || 'Failed to load history.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="admin-state-msg">Loading history...</p>;
  if (error) return <p className="admin-state-msg error">{error}</p>;
  if (history.length === 0) return <p className="admin-state-msg">No completed deliveries yet.</p>;

  return (
    <div>
      <div className="admin-panel-toolbar">
        <h3>History ({history.length})</h3>
      </div>
      <table className="admin-table">
        <thead>
          <tr><th>Order</th><th>Customer</th><th>Total</th><th>Result</th></tr>
        </thead>
        <tbody>
          {history.map((h) => (
            <tr key={h.delivery_id}>
              <td>#{h.order_id}</td>
              <td>{h.customer_name}</td>
              <td>Tk {Number(h.total_amount).toFixed(2)}</td>
              <td>
                <span className={`admin-stock-pill ${h.delivery_status === 'delivered' ? 'ok' : 'out'}`}>
                  {h.delivery_status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}