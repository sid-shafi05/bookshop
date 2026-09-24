const pg = require('pg');
require('dotenv').config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const sql = `
-- ============================================================================
-- TRIGGERS (2)
-- ============================================================================

-- Trigger 1: Stock validation on order_items insert
CREATE OR REPLACE FUNCTION fn_validate_stock() RETURNS TRIGGER AS $$
DECLARE
  available_stock INT;
BEGIN
  SELECT stock_quantity
  INTO available_stock
  FROM books
  WHERE book_id = NEW.book_id
  FOR UPDATE;

  IF available_stock IS NULL THEN
    RAISE EXCEPTION 'Book % not found', NEW.book_id;
  END IF;
  IF available_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock for book % (available: %)', NEW.book_id, available_stock;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_stock_order ON order_items;

CREATE TRIGGER trg_validate_stock_order
  BEFORE INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION fn_validate_stock();

-- Trigger 2: Review eligibility verification
CREATE OR REPLACE FUNCTION fn_verify_review_eligibility() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM order_items oi
    JOIN orders o ON o.order_id = oi.order_id
    JOIN deliveries d ON d.order_id = o.order_id
    WHERE oi.book_id = NEW.book_id
      AND o.customer_id = NEW.customer_id
      AND d.status = 'delivered'
  ) THEN
    RAISE EXCEPTION 'You can only review books you have purchased and received';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_verify_review_eligibility ON reviews;

CREATE TRIGGER trg_verify_review_eligibility
  BEFORE INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION fn_verify_review_eligibility();

-- ============================================================================
-- PROCEDURES (2)
-- ============================================================================

-- Procedure 1: Cancel order (multi-table: orders, order_items, books, notifications)
CREATE OR REPLACE PROCEDURE proc_cancel_order(p_order_id INT, p_user_id INT)
LANGUAGE plpgsql AS $$
DECLARE v_customer_id INT;
BEGIN
  SELECT customer_id INTO v_customer_id FROM orders WHERE order_id = p_order_id;
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_customer_id != p_user_id THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF (SELECT status FROM orders WHERE order_id = p_order_id) NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'This order can no longer be cancelled';
  END IF;
  UPDATE books b SET stock_quantity = stock_quantity + oi.quantity
  FROM order_items oi WHERE oi.book_id = b.book_id AND oi.order_id = p_order_id;
  UPDATE orders
  SET status = 'cancelled',
      payment_status = CASE
        WHEN payment_method = 'cash_on_delivery' THEN 'unpaid'
        WHEN payment_status = 'paid' THEN 'refunded'
        ELSE payment_status
      END,
      updated_at = NOW()
  WHERE order_id = p_order_id;
  INSERT INTO notifications (user_id, text, topic, reference_type, reference_id)
  SELECT u.user_id, 'Order #' || p_order_id || ' was cancelled by the customer.', 'order', 'order', p_order_id
  FROM users u WHERE u.role = 'admin';
END;
$$;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled','returned','partially_returned'));

-- Procedure 2: Process return approval
CREATE OR REPLACE PROCEDURE proc_process_return(p_return_id INT, p_condition VARCHAR(20), p_admin_id INT)
LANGUAGE plpgsql AS $$
DECLARE
  v_order_id INT;
  v_book_id INT;
  v_qty INT;
  v_refund NUMERIC;
  v_customer_id INT;
  v_total_order_items INT;
  v_approved_returns INT;
BEGIN
  SELECT r.order_id, oi.book_id, oi.quantity,
    COALESCE(ROUND((oi.unit_price * oi.quantity * o.total_amount) /
      NULLIF((SELECT SUM(oi_total.unit_price * oi_total.quantity)
              FROM order_items oi_total WHERE oi_total.order_id = o.order_id), 0), 2), 0),
    r.customer_id
  INTO v_order_id, v_book_id, v_qty, v_refund, v_customer_id
  FROM returns r
  JOIN order_items oi ON oi.order_item_id = r.order_item_id
  JOIN orders o ON o.order_id = r.order_id
  WHERE r.return_id = p_return_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Return request not found'; END IF;
  IF (SELECT status FROM returns WHERE return_id = p_return_id) != 'requested' THEN RAISE EXCEPTION 'Already resolved'; END IF;
  UPDATE returns SET status = 'approved', condition = p_condition, refund_amount = v_refund, resolved_at = NOW() WHERE return_id = p_return_id;
  IF p_condition = 'resellable' THEN UPDATE books SET stock_quantity = stock_quantity + v_qty WHERE book_id = v_book_id; END IF;
  SELECT COUNT(*)
  INTO v_total_order_items
  FROM order_items
  WHERE order_id = v_order_id;
  SELECT COUNT(*)
  INTO v_approved_returns
  FROM returns
  WHERE order_id = v_order_id
    AND status IN ('approved', 'processed');
  IF v_approved_returns = v_total_order_items THEN
    UPDATE orders SET status = 'returned', payment_status = 'refunded', updated_at = NOW() WHERE order_id = v_order_id;
  ELSE
    UPDATE orders SET status = 'partially_returned', payment_status = 'partial_refund', updated_at = NOW() WHERE order_id = v_order_id;
  END IF;
  INSERT INTO notifications (user_id, text, topic, reference_type, reference_id)
  VALUES (v_customer_id, CASE WHEN p_condition = 'resellable' THEN 'Return approved for Order #' || v_order_id || ' - item restocked. Refund of ' || v_refund || ' issued.' ELSE 'Return approved for Order #' || v_order_id || ' - item written off. Refund of ' || v_refund || ' issued.' END, 'return', 'order', v_order_id);
END;
$$;

UPDATE returns r
SET refund_amount = COALESCE(ROUND((oi.unit_price * oi.quantity * o.total_amount) /
  NULLIF((SELECT SUM(oi_total.unit_price * oi_total.quantity)
          FROM order_items oi_total WHERE oi_total.order_id = o.order_id), 0), 2), 0)
FROM order_items oi
     , orders o
WHERE oi.order_item_id = r.order_item_id
  AND o.order_id = r.order_id
  AND r.status IN ('approved', 'processed')
  AND r.refund_amount = 0;

WITH return_summary AS (
  SELECT o.order_id,
    COUNT(DISTINCT oi.order_item_id)::INT AS total_items,
    COUNT(DISTINCT oi.order_item_id) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM returns approved_return
        WHERE approved_return.order_item_id = oi.order_item_id
          AND approved_return.status IN ('approved', 'processed')
      )
    )::INT AS approved_items,
    COUNT(r.return_id)::INT AS return_rows
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  LEFT JOIN returns r ON r.order_id = o.order_id
  GROUP BY o.order_id
)
UPDATE orders o
SET status = CASE
    WHEN rs.approved_items = 0 THEN 'delivered'
    WHEN rs.approved_items = rs.total_items THEN 'returned'
    ELSE 'partially_returned'
  END,
  payment_status = CASE
    WHEN rs.approved_items = 0 THEN 'paid'
    WHEN rs.approved_items = rs.total_items THEN 'refunded'
    ELSE 'partial_refund'
  END,
  updated_at = NOW()
FROM return_summary rs
WHERE o.order_id = rs.order_id
  AND rs.return_rows > 0
  AND o.status NOT IN ('cancelled', 'pending', 'confirmed', 'processing');

UPDATE orders
SET payment_status = CASE
  WHEN payment_method = 'cash_on_delivery' THEN 'unpaid'
  WHEN payment_status = 'paid' THEN 'refunded'
  ELSE payment_status
END,
updated_at = NOW()
WHERE status = 'cancelled';

-- ============================================================================
-- FUNCTIONS (7)
-- ============================================================================

DROP FUNCTION IF EXISTS fn_calculate_refund(INT);
DROP FUNCTION IF EXISTS fn_customer_lifetime_value(INT);

-- 1. Check stock availability
CREATE OR REPLACE FUNCTION fn_check_stock(p_book_id INT, p_qty INT) RETURNS BOOLEAN LANGUAGE sql AS $$
  SELECT stock_quantity >= p_qty FROM books WHERE book_id = p_book_id;
$$;

-- 2. Monthly net revenue
DROP FUNCTION IF EXISTS fn_monthly_revenue(INT);
CREATE OR REPLACE FUNCTION fn_monthly_revenue(p_months INT DEFAULT 12)
RETURNS TABLE (month DATE, revenue NUMERIC, orders INT) LANGUAGE sql AS $$
  WITH months AS (
    SELECT DATE_TRUNC('month', CURRENT_DATE) - (series.month_offset * INTERVAL '1 month') AS month_start
    FROM generate_series(p_months - 1, 0, -1) AS series(month_offset)
  ), order_net AS (
    SELECT DATE_TRUNC('month', o.order_date) AS month_start,
      SUM(o.total_amount - COALESCE(refunds.refund_total, 0)) AS revenue,
      COUNT(*)::INT AS orders
    FROM orders o
    LEFT JOIN (
      SELECT order_id, SUM(refund_amount) AS refund_total
      FROM returns
      WHERE status IN ('approved', 'processed')
      GROUP BY order_id
    ) refunds ON refunds.order_id = o.order_id
    WHERE o.status <> 'cancelled'
    GROUP BY DATE_TRUNC('month', o.order_date)
  )
  SELECT months.month_start::DATE,
    COALESCE(order_net.revenue, 0),
    COALESCE(order_net.orders, 0)::INT
  FROM months
  LEFT JOIN order_net ON order_net.month_start = months.month_start
  ORDER BY months.month_start;
$$;

-- 3. Top selling books after approved returns
DROP FUNCTION IF EXISTS fn_top_selling_books(INT);
CREATE OR REPLACE FUNCTION fn_top_selling_books(p_limit INT DEFAULT 10)
RETURNS TABLE (book_id INT, title VARCHAR, qty_sold INT, revenue NUMERIC) LANGUAGE sql AS $$
  SELECT b.book_id, b.title,
    SUM(CASE WHEN returned_items.order_item_id IS NULL THEN oi.quantity ELSE 0 END)::INT AS qty_sold,
    SUM(CASE WHEN returned_items.order_item_id IS NULL
      THEN oi.quantity * oi.unit_price * o.total_amount /
        NULLIF((SELECT SUM(oi_total.unit_price * oi_total.quantity)
                FROM order_items oi_total WHERE oi_total.order_id = o.order_id), 0)
      ELSE 0 END) AS revenue
  FROM order_items oi
  JOIN books b ON b.book_id = oi.book_id
  JOIN orders o ON o.order_id = oi.order_id
  LEFT JOIN (
    SELECT DISTINCT order_item_id
    FROM returns
    WHERE status IN ('approved', 'processed')
  ) returned_items ON returned_items.order_item_id = oi.order_item_id
  WHERE o.status <> 'cancelled'
  GROUP BY b.book_id, b.title
  HAVING SUM(CASE WHEN returned_items.order_item_id IS NULL THEN oi.quantity ELSE 0 END) > 0
  ORDER BY qty_sold DESC, revenue DESC
  LIMIT p_limit;
$$;

-- 4. Low stock books
CREATE OR REPLACE FUNCTION fn_low_stock_books(p_threshold INT DEFAULT 10)
RETURNS TABLE (book_id INT, title VARCHAR, stock_quantity INT, category VARCHAR) LANGUAGE sql AS $$
  SELECT b.book_id, b.title, b.stock_quantity, NULL::VARCHAR AS category
  FROM books b
  WHERE b.stock_quantity <= p_threshold ORDER BY b.stock_quantity ASC;
$$;

-- 5. Category net revenue by category attribution
CREATE OR REPLACE FUNCTION fn_category_revenue()
RETURNS TABLE (category VARCHAR, revenue NUMERIC, pct NUMERIC) LANGUAGE sql AS $$
  WITH returned_items AS (
    SELECT DISTINCT order_item_id
    FROM returns
    WHERE status IN ('approved', 'processed')
  ), category_totals AS (
    SELECT c.category_name AS category,
      SUM(CASE WHEN returned_items.order_item_id IS NULL
        THEN oi.quantity * oi.unit_price * o.total_amount /
          NULLIF((SELECT SUM(oi_total.unit_price * oi_total.quantity)
                  FROM order_items oi_total WHERE oi_total.order_id = o.order_id), 0)
        ELSE 0 END) AS revenue
    FROM order_items oi
    JOIN books b ON b.book_id = oi.book_id
    JOIN book_categories bc ON bc.book_id = b.book_id
    JOIN categories c ON c.category_id = bc.category_id
    JOIN orders o ON o.order_id = oi.order_id
    LEFT JOIN returned_items ON returned_items.order_item_id = oi.order_item_id
    WHERE o.status <> 'cancelled'
    GROUP BY c.category_name
  )
  SELECT category, revenue,
    revenue * 100.0 / NULLIF(SUM(revenue) OVER (), 0) AS pct
  FROM category_totals
  ORDER BY revenue DESC;
$$;

-- 8. Top rated books
CREATE OR REPLACE FUNCTION fn_top_rated_books(p_limit INT DEFAULT 10)
RETURNS TABLE (book_id INT, title VARCHAR, avg_rating NUMERIC, review_count INT) LANGUAGE sql AS $$
  SELECT b.book_id, b.title, ROUND(AVG(r.rating)::NUMERIC, 2) as avg_rating, COUNT(r.review_id) as review_count
  FROM reviews r JOIN books b ON b.book_id = r.book_id GROUP BY b.book_id, b.title
  HAVING COUNT(r.review_id) >= 3 ORDER BY avg_rating DESC, review_count DESC LIMIT p_limit;
$$;

-- 9. Quick stats
CREATE OR REPLACE FUNCTION fn_quick_stats()
RETURNS TABLE (total_revenue NUMERIC, total_orders INT, total_customers INT, low_stock_count INT) LANGUAGE sql AS $$
  SELECT COALESCE(SUM(o.total_amount - COALESCE(refunds.refund_total, 0)), 0) as total_revenue, COUNT(*)::INT as total_orders,
    (SELECT COUNT(*) FROM users WHERE role = 'customer') as total_customers,
    (SELECT COUNT(*) FROM books WHERE stock_quantity <= 10) as low_stock_count
  FROM orders o
  LEFT JOIN (
    SELECT order_id, SUM(refund_amount) AS refund_total
    FROM returns
    WHERE status IN ('approved', 'processed')
    GROUP BY order_id
  ) refunds ON refunds.order_id = o.order_id
  WHERE o.status <> 'cancelled';
$$;
`;

async function run() {
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Migration completed successfully');
  } catch (e) {
    console.error('Migration error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}
run();