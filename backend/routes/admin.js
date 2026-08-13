const express = require('express');
const router= express.Router();
const pool = require('../db');



router.post('/books', async (req, res) => {
    const{title,isbn, price, stock_quantity,publication_year} = req.body;

    try{
        const result = await pool.query(
            'INSERT INTO books (title, isbn, price, stock_quantity, publication_year) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [title,isbn, price, stock_quantity,publication_year]
        );
        res.status(201).json(result.rows[0]);
    }catch(err){
        console.error('Error adding book:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


module.exports = router;