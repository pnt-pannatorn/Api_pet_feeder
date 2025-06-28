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

let onlineDevices = {};
const timeoutMs = 30000; // 30 seconds


app.post("/ping", (req, res) => {
  const { device_id } = req.body;

  if (!device_id) {
    return res.status(400).json({ error: "device_id is required" });
  }

  onlineDevices[device_id] = Date.now();
  res.json({ ok: true });
});

app.get('/device-status', (req, res) => {
  const { device_id } = req.query;

  if (!device_id) {
    return res.status(400).json({ error: 'device_id is required' });
  }

  const lastPing = onlineDevices[device_id];
  const isOnline = lastPing && (Date.now() - lastPing <= timeoutMs);

  const utc7OffsetMs = 7 * 60 * 60 * 1000; // 7 ชั่วโมงในมิลลิวินาที

  res.json({
    device_id,
    online: !!isOnline,
    last_ping: lastPing
      ? new Date(lastPing + utc7OffsetMs).toISOString()
      : null,
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("CORS-enabled web server listening on port 3000");
});

// export the app for vercel serverless functions
module.exports = app;
