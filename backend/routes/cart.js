const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');
// adding verifyToken middleware to ALL cart routes
router.use(verifyToken);
// HELPER: Stock Validator
// Returns { valid: true } or { valid: false, status, message }
async function validateBookStock(bookId, requestedQty) {
    const res = await pool.query(
        'SELECT title, stock_quantity FROM books WHERE book_id = $1',
        [bookId]
    );

    if (res.rows.length === 0) {
        return { valid: false, status: 404, message: 'Book not found' };
    }

    const { title, stock_quantity } = res.rows[0];

    if (stock_quantity <= 0) {
        return { valid: false, status: 400, message: `"${title}" is out of stock.` };
    }

    if (requestedQty > stock_quantity) {
        return {
            valid: false,
            status: 400,
            message: `Cannot request ${requestedQty} copies of "${title}". Only ${stock_quantity} available in stock.`
        };
    }

    return { valid: true, availableStock: stock_quantity, title };
}

router.get('/:customer_id', async (req, res) => {
    const { customer_id } = req.params;
     //check ownership
  if (Number(customer_id) !== req.userId) {
    return res.status(403).json({ error: 'Access denied: not your cart' });
  }

    try {
        const query =
                        ` SELECT b.book_id,b.title,b.cover_url,b.price,ci.quantity,(b.price*ci.quantity) AS per_book_total,
                            COALESCE(STRING_AGG(a.name,', '), 'Various Authors') AS author_names
        FROM carts c  
        join cart_items ci ON c.cart_id=ci.cart_id 
        join books b on ci.book_id=b.book_id 
        LEFT JOIN book_authors ba on ba.book_id=b.book_id 
        LEFT JOIN authors a on a.author_id=ba.author_id
        where c.customer_id=$1
        GROUP BY b.book_id, b.title, b.cover_url, ci.quantity, b.price
        order by b.book_id ASC;
         `;

        const result = await pool.query(query, [customer_id]);

        let subtotal = 0;

        for (let book of result.rows) {
            subtotal = subtotal + Number(book.per_book_total);
        }

        res.json({ items: result.rows, total_items: result.rows.length, cart_subtotal: subtotal.toFixed(2) });
    } catch (err) {
        console.error('Error fetching cart:', err.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
);

router.post('/add',async (req, res) => {
    const { customer_id, book_id, quantity } = req.body;

    // Ownership check
    if (Number(customer_id) !== req.userId) {
        return res.status(403).json({ error: 'Access denied: not your cart' });
    }

    const addQty = Number(quantity) || 1;
    if (!Number.isInteger(addQty) || addQty <= 0) {
        return res.status(400).json({ error: 'Quantity must be a positive whole number' });
    }
try{
    await pool.query(
        `INSERT INTO carts (customer_id)
         SELECT customer_id FROM customers WHERE customer_id = $1
         ON CONFLICT (customer_id) DO NOTHING`,
        [customer_id]
    );

    const existing = await pool.query(
        `SELECT quantity FROM cart_items 
         WHERE cart_id = (SELECT cart_id FROM carts WHERE customer_id = $1) 
           AND book_id = $2`,
        [customer_id, book_id]
    );
    const inCart = existing.rows.length > 0 ? existing.rows[0].quantity : 0;
    const totalRequested = inCart + addQty;

    const stockCheck = await validateBookStock(book_id, totalRequested);
    if (!stockCheck.valid) {
        return res.status(stockCheck.status).json({ error: stockCheck.message });
    }

    const insertRes = await pool.query(
        `INSERT INTO cart_items (cart_id, book_id, quantity)
         VALUES ((SELECT cart_id FROM carts WHERE customer_id = $1), $2, $3)
         ON CONFLICT (cart_id, book_id)
         DO UPDATE SET quantity = cart_items.quantity + $3
         RETURNING *`,
        [customer_id, book_id, addQty]
    );

    res.status(201).json({ message: 'Book added to cart', item: insertRes.rows[0] });
}catch(err){
      console.error('Error adding to cart:', err.message);
        res.status(500).json({ error: 'Internal Server Error' });
}
});

router.put('/update', async (req, res) => {
    const { customer_id, book_id, updated_qty } = req.body;

    // Object-Level Ownership Check
    if (Number(customer_id) !== req.userId) {
        return res.status(403).json({ error: 'Forbidden: Cannot modify another customer’s cart' });
    }

    const newQty = Number(updated_qty);

    try {
        if (newQty <= 0) {
            await pool.query(
                `DELETE FROM cart_items
                 WHERE cart_id = (SELECT cart_id FROM carts WHERE customer_id = $1)
                   AND book_id = $2;`,
                [customer_id, book_id]
            );
            return res.status(200).json({ message: 'Item removed from cart because quantity reached 0' });
        }

        const stockCheck = await validateBookStock(book_id, newQty);
        if (!stockCheck.valid) {
            return res.status(stockCheck.status).json({ error: stockCheck.message });
        }

        const updateQuery = `
            UPDATE cart_items
            SET quantity = $3
            WHERE cart_id = (SELECT cart_id FROM carts WHERE customer_id = $1)
              AND book_id = $2
            RETURNING *;
        `;
        const result = await pool.query(updateQuery, [customer_id, book_id, newQty]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found in your cart' });
        }

        res.status(200).json({
            message: 'Quantity updated successfully',
            item: result.rows[0]
        });
    } catch (err) {
        console.error('Error updating cart:', err.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.delete('/remove', async (req, res) => {

    const { customer_id, book_id } = req.body;
         //check ownership
  if (Number(customer_id) !== req.userId) {
    return res.status(403).json({ error: 'Access denied: not your cart' });
  }

    try {
        const query = `
        DELETE FROM cart_items
        where cart_id=(SELECT cart_id from carts where customer_id=$1)
        and book_id=$2;
        `;

        const result = await pool.query(query, [customer_id, book_id]);

        res.json({ message: 'Item removed from cart' });
    } catch (err) {
        console.error('Error deleting cart item:', err.message);
        res.status(500).json({ error: 'Failed to remove item' });
    }
});

module.exports = router;