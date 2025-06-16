const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
require("dotenv").config();
const app = express();

app.use(cors());
app.use(express.json());

const connection = mysql.createConnection(process.env.DATABASE_URL);

app.get("/", (req, res) => {
  res.send("Hello world!!");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("CORS-enabled web server listening on port 3000");
});

// export the app for vercel serverless functions
module.exports = app;
