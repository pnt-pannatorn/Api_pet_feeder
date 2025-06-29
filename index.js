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
const timeoutMs = 60000; // 30 seconds

//check if the device is online
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

//check for command
let latestCommand = null;  // ตัวแปรไว้เก็บคำสั่งล่าสุด

//สั่งจากเว็บหรือ LINE → ส่งคำสั่งให้ ESP
app.post("/command", (req, res) => {
  const { device_id, action } = req.body;
  if (!device_id || !action) {
    return res.status(400).json({ error: "device_id and action are required" });
  }

  latestCommand = { device_id, action };
  res.json({ status: "command saved" });
});

//ESP ดึงคำสั่งล่าสุด
app.get("/get-command", (req, res) => {
  res.json(latestCommand || {});
});

//ESP ส่งกลับว่าได้รับแล้ว → เคลียร์คำสั่ง
app.post("/acknowledge", (req, res) => {
  const { device_id } = req.body;
  if (latestCommand && latestCommand.device_id === device_id) {
    latestCommand = null;
    res.json({ status: "acknowledged" });
  } else {
    res.json({ status: "no command to acknowledge" });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("CORS-enabled web server listening on port 3000");
});

// export the app for vercel serverless functions
module.exports = app;
