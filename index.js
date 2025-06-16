const express = require('express') 
const cors = require('cors') 
const mysql = require('mysql2') 
require('dotenv').config() 
const app = express() 
 
app.use(cors()) 
app.use(express.json()) 
 
const connection = 
mysql.createConnection(process.env.DATABASE_URL) 
 
app.get('/', (req, res) => { 
    res.send('Hello world!!') 
}) 