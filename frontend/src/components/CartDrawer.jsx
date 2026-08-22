// src/components/CartDrawer.jsx
export default function CartDrawer({ isOpen, onClose, cart, onUpdateQty, onRemoveItem }) {
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
            cart.items.map((item) => (
              <div key={item.book_id} className="cart-row">
                <div className="row-info">
                  <h4>{item.title}</h4>
                  <span className="row-price">Tk {Number(item.per_book_total).toFixed(2)}</span>
                </div>
                <div className="row-controls">
  {/* Minus Button */}
  <button onClick={() => onUpdateQty(item.book_id, item.quantity - 1)}>-</button>

  {/* Manually Typable Quantity Input */}
<input 
  type="number" 
  min="0"
  className="qty-input-box"
  defaultValue={item.quantity}
  key={item.quantity} // Automatically updates when clicking + or -
  onBlur={(e) => {
    const val = parseInt(e.target.value, 10);
    
    if (!isNaN(val)) {
      if (val === 0) {
        // Typing 0 deletes the book from the cart
        if (typeof onRemoveItem === 'function') {
          onRemoveItem(item.book_id);
        } else {
          onUpdateQty(item.book_id, 0); // Backend deletes when qty <= 0
        }
      } else if (val > 0) {
        // Updates to the positive number
        onUpdateQty(item.book_id, val);
      }
    } else {
      e.target.value = item.quantity; // Reverts back if left completely blank
    }
  }}
  onKeyDown={(e) => {
    if (e.key === 'Enter') {
      e.target.blur(); // Triggers onBlur immediately when pressing Enter
    }
  }}
/>

  {/* Plus Button */}
  <button onClick={() => onUpdateQty(item.book_id, item.quantity + 1)}>+</button>

  {/* Trash Remove Button */}
  <button className="btn-remove" onClick={() => onRemoveItem(item.book_id)}>🗑️</button>
</div>
              </div>
            ))
          )}
        </div>

        {cart.items && cart.items.length > 0 && (
          <div className="drawer-bottom">
            <div className="bill-row">
              <span>Subtotal</span>
              <strong>Tk {cart.cart_subtotal}</strong>
            </div>
            <button className="primary-checkout-btn" onClick={() => alert('Proceeding to checkout...')}>
              Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}