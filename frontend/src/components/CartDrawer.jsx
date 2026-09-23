// src/components/CartDrawer.jsx
export default function CartDrawer({ isOpen, onClose, cart, onUpdateQty, onRemoveItem, onCheckout, showToast }) {
  if (!isOpen) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-top">
          <h3>Shopping Cart ({cart.items ? cart.items.length : 0})</h3>
          <button className="close-x" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-items">
          {!cart.items || cart.items.length === 0 ? (
            <div className="empty-cart-view">
              <p>Your cart is empty.</p>
            </div>
          ) : (
            cart.items.map((item) => {
              const availableStock = Number(item.stock_quantity ?? 0);
              const lowStock = availableStock > 0 && availableStock <= 5;
              const canAddMore = availableStock > 0 && item.quantity < availableStock;

              return (
                <div key={item.book_id} className="cart-row">
                  <div className="row-info">
                    <h4>{item.title}</h4>
                    <span className="row-price">Tk {Number(item.per_book_total).toFixed(2)}</span>
                    {lowStock && <div className="cart-stock-warning">Only {availableStock} left in stock</div>}
                  </div>
                  <div className="row-controls">
                    <button disabled={item.quantity <= 0} onClick={() => onUpdateQty(item.book_id, item.quantity - 1)}>-</button>

                    <input 
                      type="number" 
                      min="0"
                      max={availableStock || undefined}
                      className="qty-input-box"
                      defaultValue={item.quantity}
                      key={item.quantity}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (Number.isNaN(val)) {
                          e.target.value = item.quantity;
                          return;
                        }

                        if (val === 0) {
                          if (typeof onRemoveItem === 'function') {
                            onRemoveItem(item.book_id);
                          } else {
                            onUpdateQty(item.book_id, 0);
                          }
                          return;
                        }

                        if (val > availableStock) {
                          const message = `Only ${availableStock} copies available for "${item.title}".`;
                          if (showToast) showToast(message);
                          e.target.value = item.quantity;
                          return;
                        }

                        onUpdateQty(item.book_id, val);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.target.blur();
                        }
                      }}
                    />

                    <button
                      disabled={!canAddMore}
                      onClick={() => {
                        if (!canAddMore) {
                          if (showToast) showToast(`Only ${availableStock} copies available for "${item.title}".`);
                          return;
                        }
                        onUpdateQty(item.book_id, item.quantity + 1);
                      }}
                      title={canAddMore ? 'Add more' : `Max available: ${availableStock}`}
                    >
                      +
                    </button>

                    <button className="btn-remove" onClick={() => onRemoveItem(item.book_id)}>🗑️</button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {cart.items && cart.items.length > 0 && (
          <div className="drawer-bottom">
            <div className="bill-row">
              <span>Subtotal</span>
              <strong>Tk {cart.cart_subtotal}</strong>
            </div>
            <button className="primary-checkout-btn" onClick={onCheckout}>
              Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}