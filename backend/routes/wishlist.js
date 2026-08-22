const express = require('express');
const router= express.Router();
const pool = require('../db');


//show all the wishlists of a customer(GET)
//shows an icon(various book cards as the icon) , and beneath it, shows
//the name and book count of that wishlist(barnes and noble)
router.get('/customer/:customer_id',async(req,res)=>{
    const{customer_id}=req.params;
    try{
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
//just shows the list of all books in it 
//each book: title,author,rating(not yet)

router.get('/:wishlist_id',async(req,res)=>{

    const{wishlist_id}=req.params;
    try{

       const query=`
        SELECT b.book_id,b.title,b.cover_url,b.price,STRING_AGG(a.name,', ') AS author_names,wi.added_at
        from wishlist_items wi 
        JOIN books b ON wi.book_id = b.book_id
        JOIN book_authors ba ON b.book_id = ba.book_id
        JOIN authors a ON ba.author_id = a.author_id
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
//in wishlist table, wishlist_id is auto incrementing
router.post('/create',async(req,res)=>{
    const{customer_id,wishlist_name}=req.body;
    if(!wishlist_name || wishlist_name.trim()===''){
        return res.status(400).json({error:'Wishlsit name cannot be empty!'});
    }
    const wishlist_name_clean=wishlist_name.trim();

    try{
 //See if a list with this name already exists for this customer
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
//now create the new one
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
//checks if the book is already in this specific wishlist by using On CONFLICT
try{
            const query = `
            INSERT INTO wishlist_items (wishlist_id, book_id)
            VALUES ($1, $2)
            ON CONFLICT (wishlist_id, book_id) DO NOTHING
            RETURNING *;
        `;
        const result = await pool.query(query, [wishlist_id, book_id]);

        if (result.rows.length === 0) {
            return res.json({ message: 'Book already exists in this wishlist!' });
        }

        res.status(201).json({
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
//when a specific wishlist is being deleted, all its items must also be deleted
//which means the effect should be passed on to/cascaded to its rows in the wishlist_items table 
// from the table -> FOREIGN KEY (wishlist_id) REFERENCES wishlists(wishlist_id) ON DELETE CASCADE,

router.delete('/:wishlist_id',async(req,res)=>{
const{wishlist_id}=req.params;
    try {
    //the default 'My Wishlist" cannot be deleted-either delete icon is absent/if there is an icon, deleting is forbidden
    //standard behaviour of many famous bookstores 
        const check = await pool.query('SELECT wishlist_name FROM wishlists WHERE wishlist_id = $1', [wishlist_id]);
        
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Wishlist not found' });
        }

        if (check.rows[0].wishlist_name === 'My Wishlist') {
            return res.status(400).json({ error: 'The default "My Wishlist" cannot be deleted.' });
        }



//if it is custom, delete it

        // ON DELETE CASCADE automatically deletes its wishlist_items too!
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

    if (!new_name || new_name.trim() === '') {
        return res.status(400).json({ error: 'Wishlist name cannot be empty!' });
    }
    const cleanName = new_name.trim();

    try {
        const check = await pool.query('SELECT wishlist_name FROM wishlists WHERE wishlist_id = $1', [wishlist_id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Wishlist not found' });
        }

        // Prevent renaming the default 'My Wishlist'
        if (check.rows[0].wishlist_name === 'My Wishlist') {
            return res.status(400).json({ error: 'The default "My Wishlist" cannot be renamed.' });
        }

        // Check if name conflicts with another list
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
