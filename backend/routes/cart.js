const express = require('express');
const router = express.Router();
const pool = require('../db');

//view cart's current situation
//frontend sends something like GET/cart/customer_id
router.get('/:customer_id', async (req, res) => {

    //req is the http request sent to our express server

    //req contains everything sent

    //req.params is used when a variable is written directly into the URL route using a colon (:).
    // /When a user visits this URL in their browser:
    //http://localhost:3000/cart/5
    //Express grabs the number 5 from the URL and puts it into req.params

    //req.body contains data that is hidden inside the request envelope (not visible in the URL bar). This is used with POST and PUT requests when users submit forms or send JSON.


    const { customer_id } = req.params;

    try {
        const query =
            //cart usually shows book image,title ,author,price(unit_price*qty), subtotal(sum of all unit_price*qty)

            //ci.quantity for the -> - [qty] + selector inside the cart
            ` SELECT b.book_id,b.title,b.cover_url,b.price,ci.quantity,(b.price*ci.quantity) AS per_book_total,STRING_AGG(a.name,', ') AS author_names
        FROM carts c  
        join cart_items ci ON c.cart_id=ci.cart_id 
        join books b on ci.book_id=b.book_id 
        join book_authors ba on ba.book_id=b.book_id 
        join authors a on a.author_id=ba.author_id
        where c.customer_id=$1
        GROUP BY b.book_id, b.title, b.cover_url, ci.quantity, b.price
        order by b.book_id ASC;
         `;

        const result = await pool.query(query, [customer_id]);

        //subtotal 

        let subtotal = 0;

        // Loop through each book inside the cart list
        for (let book of result.rows) {
            // Convert the book's price text to a real number, and add it to the total
            subtotal = subtotal + Number(book.per_book_total);
        }

        res.json({ items: result.rows, total_items: result.rows.length, cart_subtotal: subtotal.toFixed(2) });
    } catch (err) {
        console.error('Error fetching cart:', err.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
);

//add books to the cart- called whenever the "add to cart" is clicked

router.post('/add', async (req, res) => {

    const { customer_id, book_id, quantity } = req.body;

    const qty = quantity || 1;

    try {

        //create a new row if the book is not in the cart yet, if already present, increment qty by 1
        const query = `
       INSERT INTO cart_items(cart_id,book_id,quantity)
       VALUES(
       (SELECT cart_id from carts where customer_id=$1),
       $2,$3)
       on CONFLICT (cart_id,book_id)
       DO UPDATE SET  quantity=cart_items.quantity+$3
       RETURNING *; 
    
    `; //instantly return the new data 

        const result = await pool.query(query, [customer_id, book_id, qty]);
        res.status(201).json({
            message: 'Book successfully added to the cart!',
            item: result.rows[0]
        });
    } catch (err) {
        console.error('Error adding to cart:', err.message);
        res.status(500).json({ error: 'Failed to add item to cart' });
    }

}

);


//update(PUT) book count(incr/decr using the +- buttons)

router.put('/update', async (req, res) => {

    const { customer_id, book_id, updated_qty } = req.body;


    try {
        //if the qty is decremented to 0 by clicking the - button ,delete the row for the corresponding book
        if (updated_qty <= 0) {

            const query = `
        DELETE FROM cart_items
        where cart_id=(SELECT cart_id from carts where customer_id=$1)
        and book_id=$2;
        `;

            const result = await pool.query(query, [customer_id, book_id]);

            res.json({ message: 'Item removed from cart' });
        }

        else {

            //update to the new qty 
            const query = `
         UPDATE cart_items
         set quantity=$3
         where cart_id=(select cart_id from carts where customer_id=$1)
         and book_id=$2 
         RETURNING *;
        `;

            const result = await pool.query(query, [customer_id, book_id, updated_qty]);

            res.json(result.rows[0]);
        }
    } catch (err) {
        console.error('Error updating cart:', err.message);
        res.status(500).json({ error: 'Failed to update quantity' });
    }
}
);

//remove books - this means when clicking the trash can icon beside a book in the cart
router.delete('/remove', async (req, res) => {

    const { customer_id, book_id } = req.body;
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