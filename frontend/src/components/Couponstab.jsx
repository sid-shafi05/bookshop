/* ==========================================================================
   COUPONS TAB
   ========================================================================== */

const EMPTY_COUPON_FORM = {
  code: '',
  discount_percent: '',
  expiry_date: '',
  min_order_amount: '',
  max_discount: '',
  is_active: true,
};

function CouponsTab() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_COUPON_FORM);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_COUPON_FORM);

  const loadCoupons = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminCoupons();
      setCoupons(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      console.error('Failed to load coupons:', err);
      setError(err.message || 'Failed to load coupons.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCoupons(); }, []);

  const buildPayload = (form) => ({
    code: form.code.trim().toUpperCase(),
    discount_percent: Number(form.discount_percent),
    expiry_date: form.expiry_date || null,
    min_order_amount: form.min_order_amount === '' ? 0 : Number(form.min_order_amount),
    max_discount: form.max_discount === '' ? null : Number(form.max_discount),
    is_active: form.is_active,
  });

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createCoupon(buildPayload(createForm));
      setCreateForm(EMPTY_COUPON_FORM);
      setShowCreateForm(false);
      loadCoupons();
    } catch (err) {
      alert(err.message || 'Failed to create coupon');
    }
  };

  const startEdit = (coupon) => {
    setShowCreateForm(false);
    setEditingId(coupon.coupon_id);
    setEditForm({
      code: coupon.code,
      discount_percent: coupon.discount_percent,
      expiry_date: coupon.expiry_date ? coupon.expiry_date.slice(0, 10) : '',
      min_order_amount: coupon.min_order_amount ?? '',
      max_discount: coupon.max_discount ?? '',
      is_active: coupon.is_active,
    });
  };

  const handleEditSubmit = async (e, id) => {
    e.preventDefault();
    try {
      // code is immutable after creation to avoid confusing anyone who
      // already has the old code — only the terms/limits get updated.
      const { code, ...rest } = buildPayload(editForm);
      await api.updateCoupon(id, rest);
      setEditingId(null);
      loadCoupons();
    } catch (err) {
      alert(err.message || 'Failed to update coupon');
    }
  };

  const handleDelete = async (id, code) => {
    if (!window.confirm(`Delete coupon "${code}"?`)) return;
    try {
      await api.deleteCoupon(id);
      loadCoupons();
    } catch (err) {
      alert(err.message || 'Failed to delete coupon');
    }
  };

  if (loading) return <p className="admin-state-msg">Loading coupons...</p>;
  if (error) return <p className="admin-state-msg error">{error}</p>;

  return (
    <div>
      <div className="admin-panel-toolbar">
        <h3>Coupons ({coupons.length})</h3>
        <button
          className={`admin-primary-btn ${showCreateForm ? 'cancel' : ''}`}
          onClick={() => { setEditingId(null); setShowCreateForm(!showCreateForm); }}
        >
          {showCreateForm ? 'Cancel' : '+ Add Coupon'}
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreateSubmit} className="admin-form-card">
          <CouponFormFields form={createForm} setForm={setCreateForm} codeEditable />
          <p style={{ fontSize: '0.8rem', color: '#8c827a', marginTop: 6 }}>
            Every current customer will get an in-app notification and an email about this coupon as soon as it's created.
          </p>
          <div className="admin-form-actions">
            <button type="submit" className="btn-save">Create Coupon</button>
          </div>
        </form>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Discount</th>
            <th>Min. Order</th>
            <th>Expiry</th>
            <th>Usage</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {coupons.length === 0 ? (
            <tr><td colSpan={7} className="admin-empty-row">No coupons yet.</td></tr>
          ) : (
            coupons.map((c) =>
              editingId === c.coupon_id ? (
                <tr key={c.coupon_id}>
                  <td colSpan={7} className="edit-row-cell">
                    <form onSubmit={(e) => handleEditSubmit(e, c.coupon_id)}>
                      <CouponFormFields form={editForm} setForm={setEditForm} codeEditable={false} />
                      <div className="admin-form-actions">
                        <button type="submit" className="btn-save">Save Changes</button>
                        <button type="button" className="btn-cancel" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={c.coupon_id}>
                  <td className="admin-cell-title">{c.code}</td>
                  <td>{Number(c.discount_percent)}%{c.max_discount ? ` (max Tk ${Number(c.max_discount).toFixed(2)})` : ''}</td>
                  <td>{Number(c.min_order_amount) > 0 ? `Tk ${Number(c.min_order_amount).toFixed(2)}` : '—'}</td>
                  <td>{c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : 'No expiry'}</td>
                  <td>Unlimited</td>
                  <td>
                    <span className={`admin-stock-pill ${c.is_active ? 'ok' : 'out'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-actions-cell">
                      <button className="admin-icon-btn" onClick={() => startEdit(c)}>Edit</button>
                      <button className="admin-icon-btn danger" onClick={() => handleDelete(c.coupon_id, c.code)}>Delete</button>
                    </div>
                  </td>
                </tr>
              )
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function CouponFormFields({ form, setForm, codeEditable }) {
  return (
    <div className="admin-form-grid">
      <input
        placeholder="Code (e.g. WELCOME10)"
        required
        disabled={!codeEditable}
        value={form.code}
        onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
      />
      <input
        placeholder="Discount % "
        type="number" min="1" max="100" step="0.01"
        required
        value={form.discount_percent}
        onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
      />
      <input
        placeholder="Min. order amount (optional)"
        type="number" min="0" step="0.01"
        value={form.min_order_amount}
        onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
      />
      <input
        placeholder="Max discount cap (optional)"
        type="number" min="0" step="0.01"
        value={form.max_discount}
        onChange={(e) => setForm({ ...form, max_discount: e.target.value })}
      />
      <input
        placeholder="Expiry date (optional)"
        type="date"
        value={form.expiry_date}
        onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
      />
      <select
        value={form.is_active ? 'active' : 'inactive'}
        onChange={(e) => setForm({ ...form, is_active: e.target.value === 'active' })}
      >
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    </div>
  );
}