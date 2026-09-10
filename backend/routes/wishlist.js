const express = require('express');
const router= express.Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');

// Add verifyToken middleware to ALL wishlist routes
router.use(verifyToken);


//show all the wishlists of a customer(GET)
router.get('/customer/:customer_id',async(req,res)=>{
    const{customer_id}=req.params;
         //check ownership
  if (Number(customer_id) !== req.userId) {
    return res.status(403).json({ error: 'Access denied: not your cart' });
  }


    try{
                await pool.query(
                    `INSERT INTO wishlists (customer_id, wishlist_name)
                     SELECT customer_id, 'My Wishlist' FROM customers WHERE customer_id = $1
                     ON CONFLICT (customer_id, wishlist_name) DO NOTHING`,
                    [customer_id]
                );
        const query=`
                SELECT 
                w.wishlist_id,
                w.wishlist_name,
                w.created_at,
                COUNT(wi.book_id) AS total_saved_books
            FROM wishlists w
            LEFT JOIN wishlist_items wi ON w.wishlist_id = wi.wishlist_id
            WHERE w.customer_id = $1
            GROUP BY w.wishlist_id, w.wishlist_name, w.created_at
            ORDER BY w.created_at DESC;
        `;
        const result = await pool.query(query, [customer_id]);
        res.json(result.rows);
        } catch (err) {
        console.error('Error fetching wishlists:', err.message);
        res.status(500).json({ error: 'Failed to fetch customer wishlists' });
    }
}
);

//show all the books of a particular wishlist(GET)
router.get('/:wishlist_id',async(req,res)=>{

    const{wishlist_id}=req.params;
    try{
   //first verify wishlist ownership
    const ownerCheck = await pool.query(
      'SELECT customer_id FROM wishlists WHERE wishlist_id = $1',
      [wishlist_id]
    );
    
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Wishlist not found' });
    }

    if (Number(ownerCheck.rows[0].customer_id) !== req.userId) {
      return res.status(403).json({ error: 'Access denied: not your wishlist' });
    }
       const query=`
         SELECT b.book_id,b.title,b.cover_url,b.price,
             COALESCE(STRING_AGG(a.name,', '), 'Various Authors') AS author_names,wi.added_at
        from wishlist_items wi 
        JOIN books b ON wi.book_id = b.book_id
        LEFT JOIN book_authors ba ON b.book_id = ba.book_id
        LEFT JOIN authors a ON ba.author_id = a.author_id
        WHERE wi.wishlist_id = $1
        GROUP BY b.book_id, b.title, b.price, b.cover_url, wi.added_at
        ORDER BY wi.added_at DESC;
        `;

        const result=await pool.query(query,[wishlist_id]);
        res.json({
            books:result.rows,
            total:result.rows.length,
            wishlist_id:wishlist_id
        });

    }catch(err){
        console.error('Error fetching wishlist books:', err.message);
        res.status(500).json({ error: 'Failed to fetch wishlist books' });

    }
});


//create (POST)a custom wishlist 
router.post('/create',async(req,res)=>{
    const{customer_id,wishlist_name}=req.body;
             //check ownership
  if (Number(customer_id) !== req.userId) {
    return res.status(403).json({ error: 'Access denied: not your cart' });
  }

    if(!wishlist_name || wishlist_name.trim()===''){
        return res.status(400).json({error:'Wishlsit name cannot be empty!'});
    }
    const wishlist_name_clean=wishlist_name.trim();

    try{
        const checkQuery = `
            SELECT wishlist_id 
            FROM wishlists 
            WHERE customer_id = $1 AND wishlist_name = $2;
        `;
        const is_existing = await pool.query(checkQuery, [customer_id, wishlist_name_clean]);

        if (is_existing.rows.length > 0) {
            return res.status(409).json({ 
                error: `You already have a wishlist named "${wishlist_name_clean}". Please choose a different name.` 
            });
        }

        const insert_query=`
           INSERT INTO wishlists(customer_id,wishlist_name)
           VALUES($1,$2)
           RETURNING *;
        `;

        const result=await pool.query(insert_query,[customer_id,wishlist_name_clean]);
        res.status(201).json({
            wishlist:result.rows[0]
        });
    }catch (err) {
        console.error('Error creating wishlist:', err.message);
        res.status(500).json({ error: 'Failed to create wishlist' });
    }
});

//save(POST) books in a wishlist
router.post('/add',async(req,res)=>{
const{book_id,wishlist_id}=req.body;
try{
    const ownerCheck = await pool.query(
      'SELECT customer_id FROM wishlists WHERE wishlist_id = $1',
      [wishlist_id]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Wishlist not found' });
    }

    if (Number(ownerCheck.rows[0].customer_id) !== req.userId) {
      return res.status(403).json({ error: 'Access denied: not your wishlist' });
    }

            const query = `
            INSERT INTO wishlist_items (wishlist_id, book_id)
            VALUES ($1, $2)
            ON CONFLICT (wishlist_id, book_id) DO NOTHING
            RETURNING *;
        `;
        const result = await pool.query(query, [wishlist_id, book_id]);

        if (result.rows.length === 0) {
                        return res.json({
                            added: false,
                            message: 'Book already exists in this wishlist.'
                        });
        }

        res.status(201).json({
                        added: true,
            message: 'Book saved to wishlist successfully!',
            item: result.rows[0]
        });

}catch (err) {
        res.status(500).json({ error: 'Failed to add book to wishlist' });
    }
}) ;


//remove a book from a specific wishlist
router.delete('/remove_book',async(req,res)=>{
    const{book_id,wishlist_id}=req.body;
    try{
    const ownerCheck = await pool.query(
      'SELECT customer_id FROM wishlists WHERE wishlist_id = $1',
      [wishlist_id]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Wishlist not found' });
    }

    if (Number(ownerCheck.rows[0].customer_id) !== req.userId) {
      return res.status(403).json({ error: 'Access denied: not your wishlist' });
    }

        const query = `
            DELETE FROM wishlist_items
            WHERE wishlist_id = $1 AND book_id = $2;
        `;
        await pool.query(query, [wishlist_id, book_id]);
        res.json({ message: 'Book removed from wishlist successfully' });

    }catch(err){
        res.status(500).json({ error: 'Failed to remove book from wishlist' });
    }
});

//delete a specific wishlist from the customer's profile
router.delete('/:wishlist_id',async(req,res)=>{
const{wishlist_id}=req.params;
    try {
        const check = await pool.query(
            'SELECT wishlist_name, customer_id FROM wishlists WHERE wishlist_id = $1',
            [wishlist_id]
        );
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Wishlist not found' });
        }

        if (Number(check.rows[0].customer_id) !== Number(req.userId)) {
            return res.status(403).json({ error: 'Access denied: not your wishlist' });
        }

        if (check.rows[0].wishlist_name === 'My Wishlist') {
            return res.status(400).json({ error: 'The default "My Wishlist" cannot be deleted.' });
        }

        await pool.query('DELETE FROM wishlists WHERE wishlist_id = $1', [wishlist_id]);
        res.json({ message: 'Wishlist deleted successfully' });
    } catch (err) {
        console.error('Error deleting wishlist:', err.message);
        res.status(500).json({ error: 'Failed to delete wishlist' });
    }
});

// PUT /wishlist/rename -> Rename a custom wishlist
router.put('/rename', async (req, res) => {
    const { wishlist_id, new_name, customer_id } = req.body;
//ownership check
  if (Number(customer_id) !== req.userId) {
    return res.status(403).json({ error: 'Access denied: cannot rename another user\'s wishlist' });
  }
    if (!new_name || new_name.trim() === '') {
        return res.status(400).json({ error: 'Wishlist name cannot be empty!' });
    }
    const cleanName = new_name.trim();

    try {
        const check = await pool.query(
            'SELECT wishlist_name, customer_id FROM wishlists WHERE wishlist_id = $1',
            [wishlist_id]
        );
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Wishlist not found' });
        }
        if (Number(check.rows[0].customer_id) !== Number(req.userId)) {
            return res.status(403).json({ error: 'Access denied: not your wishlist' });
        }

        if (check.rows[0].wishlist_name === 'My Wishlist') {
            return res.status(400).json({ error: 'The default "My Wishlist" cannot be renamed.' });
        }

        const dupCheck = await pool.query(
            'SELECT wishlist_id FROM wishlists WHERE customer_id = $1 AND wishlist_name = $2 AND wishlist_id != $3',
            [customer_id, cleanName, wishlist_id]
        );
        if (dupCheck.rows.length > 0) {
            return res.status(409).json({ error: `You already have a wishlist named "${cleanName}".` });
        }

        const updateRes = await pool.query(
            'UPDATE wishlists SET wishlist_name = $1 WHERE wishlist_id = $2 RETURNING *',
            [cleanName, wishlist_id]
        );

        res.json({ message: 'Wishlist renamed successfully!', wishlist: updateRes.rows[0] });
    } catch (err) {
        console.error('Error renaming wishlist:', err.message);
        res.status(500).json({ error: 'Failed to rename wishlist' });
    }
});

module.exports = router;