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

app.get("/device-status", (req, res) => {
  const { device_id } = req.query;

  if (!device_id) {
    return res.status(400).json({ error: "device_id is required" });
  }

  const lastPing = onlineDevices[device_id];
  const isOnline = lastPing && Date.now() - lastPing <= timeoutMs;

  const utc7OffsetMs = 7 * 60 * 60 * 1000; // 7 ชั่วโมงในมิลลิวินาที

  res.json({
    device_id,
    online: !!isOnline,
    last_ping: lastPing
      ? new Date(lastPing + utc7OffsetMs).toISOString()
      : null,
  });
});

//device status by line_uid
app.get("/devices-status", (req, res) => {
  const { line_uid } = req.query;
  if (!line_uid) {
    return res.status(400).json({ error: "line_uid is required" });
  }

  const sql = "SELECT devices_id FROM devices WHERE line_uid = ?";
  connection.query(sql, [line_uid], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    const allDevices = results.map((r) => r.devices_id);
    const online = [];
    const offline = [];

    allDevices.forEach((deviceId) => {
      const lastPing = onlineDevices[deviceId];
      const isOnline = lastPing && Date.now() - lastPing <= timeoutMs;
      if (isOnline) {
        online.push(deviceId);
      } else {
        offline.push(deviceId);
      }
    });

    res.json({
      allDevices,
      onlineDevices: online,
      offlineDevices: offline,
    });
  });
});

app.get("/devices-status-type", (req, res) => {
  const { line_uid, type } = req.query;
  if (!line_uid) {
    return res.status(400).json({ error: "line_uid is required" });
  }

  // ถ้ามี type ก็เพิ่ม filter ใน SQL
  let sql = "SELECT devices_id FROM devices WHERE line_uid = ?";
  const params = [line_uid];

  if (type) {
    sql += " AND types = ?";
    params.push(type);
  }

  connection.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    const allDevices = results.map((r) => r.devices_id);
    const online = [];
    const offline = [];

    allDevices.forEach((deviceId) => {
      const lastPing = onlineDevices[deviceId];
      const isOnline = lastPing && Date.now() - lastPing <= timeoutMs;
      if (isOnline) {
        online.push(deviceId);
      } else {
        offline.push(deviceId);
      }
    });

    res.json({
      allDevices,
      onlineDevices: online,
      offlineDevices: offline,
    });
  });
});

app.get("/device-summary", (req, res) => {
  const { line_uid } = req.query;

  if (!line_uid) return res.status(400).json({ error: "line_uid is required" });

  const sql = "SELECT devices_id FROM Devices WHERE line_uid = ?";

  connection.query(sql, [line_uid], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    const total = results.length;
    const now = Date.now();
    const timeoutMs = 60000;

    // ตรวจสอบว่าออนไลน์กี่เครื่อง
    const online = results.filter((row) => {
      const lastPing = onlineDevices[row.devices_id];
      return lastPing && now - lastPing <= timeoutMs;
    }).length;

    res.json({ total_devices: total, online_devices: online });
  });
});

//check for command
// let latestCommand = null; // ตัวแปรไว้เก็บคำสั่งล่าสุด
let latestCommand = {};

//สั่งจากเว็บหรือ LINE → ส่งคำสั่งให้ ESP
// app.post("/command", (req, res) => {
//   const { device_id, action } = req.body;
//   if (!device_id || !action) {
//     return res.status(400).json({ error: "device_id and action are required" });
//   }

//   latestCommand = { device_id, action };
//   res.json({ status: "command saved" });
// });
// //ESP ดึงคำสั่งล่าสุด
// app.get("/get-command", (req, res) => {
//   res.json(latestCommand || {});
// });
// //ESP ส่งกลับว่าได้รับแล้ว → เคลียร์คำสั่ง
// app.post("/acknowledge", (req, res) => {
//   const { device_id } = req.body;
//   if (latestCommand && latestCommand.device_id === device_id) {
//     latestCommand = null;
//     res.json({ status: "acknowledged" });
//   } else {
//     res.json({ status: "no command to acknowledge" });
//   }
// });
// สั่งงาน
app.post("/command", (req, res) => {
  const { device_id, action } = req.body;
  if (!device_id || !action) {
    return res.status(400).json({ error: "device_id and action are required" });
  }

  latestCommand[device_id] = action;
  res.json({ status: "command saved" });
});

// ESP ดึงคำสั่งล่าสุด
app.get("/get-command", (req, res) => {
  const { device_id } = req.query;
  if (!device_id) {
    return res.status(400).json({ error: "device_id is required" });
  }

  const action = latestCommand[device_id] || null;
  res.json({ device_id, action });
});

// เคลียร์คำสั่ง
app.post("/acknowledge", (req, res) => {
  const { device_id } = req.body;
  if (latestCommand[device_id]) {
    delete latestCommand[device_id]; // ✅ ลบเฉพาะของอุปกรณ์นั้น
    res.json({ status: "acknowledged" });
  } else {
    res.json({ status: "no command to acknowledge" });
  }
});

//POST /feeding-schedules → เพิ่มตารางเวลา
// app.post("/feeding-schedules", (req, res) => {
//   const { devices_id, repeat_type, date, time, amount, uid } = req.body;

//   if (!devices_id || !repeat_type || !time || !amount || !uid) {
//     return res.status(400).json({ error: "Missing required fields" });
//   }

//   const sql = `
//     INSERT INTO feeding_schedules (devices_id, repeat_type, date, time, amount, uid)
//     VALUES (?, ?, ?, ?, ?, ?)
//   `;
//   const values = [devices_id, repeat_type, date || null, time, amount, uid];

//   connection.query(sql, values, (err, results) => {
//     if (err) return res.status(500).json({ error: err.message });
//     res.json({ id: results.insertId, message: "Schedule added" });
//   });
// });
app.post("/feeding-schedules", (req, res) => {
  const { devices_id, repeat_type, date, time, amount, uid } = req.body;

  if (!devices_id || !repeat_type || !time || !amount || !uid) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // รวม date และ time เป็น string datetime
  // กรณี repeat_type เป็น once ต้องใช้ date + time, daily อาจมีแค่ time
  let datetimeStr;
  if (repeat_type === "once" && date) {
    datetimeStr = `${date}T${time}:00`; // เช่น "2023-07-14T15:30:00"
  } else {
    // daily แบบนี้ถือเวลาเป็น time เฉย ๆ
    datetimeStr = `1970-01-01T${time}:00`; // เวลาเท่านั้น กำหนดวันเป็น dummy
  }

  // แปลงเป็น Date object แล้วปรับเวลาเป็น UTC+7 (Bangkok)
  const dateObj = new Date(datetimeStr);
  // เพิ่มเวลา 7 ชั่วโมง (7 * 60 * 60 * 1000 ms)
  const dateUTC7 = new Date(dateObj.getTime() + 7 * 60 * 60 * 1000);

  // สร้าง string วันที่และเวลาใหม่ในรูปแบบ MySQL 'YYYY-MM-DD' และ 'HH:mm:ss'
  const pad = (n) => n.toString().padStart(2, "0");
  const newDate = `${dateUTC7.getUTCFullYear()}-${pad(
    dateUTC7.getUTCMonth() + 1
  )}-${pad(dateUTC7.getUTCDate())}`;
  const newTime = `${pad(dateUTC7.getUTCHours())}:${pad(
    dateUTC7.getUTCMinutes()
  )}:00`;

  const sql = `
    INSERT INTO feeding_schedules (devices_id, repeat_type, date, time, amount, uid)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  // เก็บวันกับเวลาที่ปรับเป็น UTC+7 ลงฐานข้อมูล
  const values = [
    devices_id,
    repeat_type,
    repeat_type === "once" ? newDate : null,
    newTime,
    amount,
    uid,
  ];

  connection.query(sql, values, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: results.insertId, message: "Schedule added" });
  });
});

//===================================================================
//for line
app.post("/feeding-schedules-line", (req, res) => {
  const { devices_id, repeat_type, date, time, amount, uid } = req.body;

  if (!devices_id || !repeat_type || !time || !amount || !uid) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const sql = `
    INSERT INTO feeding_schedules (devices_id, repeat_type, date, time, amount, uid)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const values = [devices_id, repeat_type, date || null, time, amount, uid];

  connection.query(sql, values, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: results.insertId, message: "Schedule added" });
  });
});

//GET /feeding-schedules?device_id=ESP001 → ให้ ESP ดึงเฉพาะรายการที่ต้องทำ "ตอนนี้"
app.get("/feeding-schedules", (req, res) => {
  const { device_id } = req.query;
  if (!device_id)
    return res.status(400).json({ error: "device_id is required" });

  const sql = `
    SELECT id, devices_id, repeat_type, date, amount,
      TIME_FORMAT(time, '%H:%i') AS time
    FROM feeding_schedules
    WHERE devices_id = ?
      AND (
        repeat_type = 'daily'
        OR (repeat_type = 'once' AND date = CURDATE())
      )
      AND ABS(TIMESTAMPDIFF(MINUTE, time, CURTIME())) <= 2
  `;

  connection.query(sql, [device_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


//DELETE /feeding-schedules/:id → ลบตารางเวลาที่ไม่ต้องการ
app.delete("/feeding-schedules/:id", (req, res) => {
  const id = req.params.id;

  const sql = `DELETE FROM feeding_schedules WHERE id = ?`;
  connection.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.affectedRows === 0)
      return res.status(404).json({ error: "Not found" });

    res.json({ message: "Schedule deleted" });
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("CORS-enabled web server listening on port 3000");
});

// export the app for vercel serverless functions
module.exports = app;
