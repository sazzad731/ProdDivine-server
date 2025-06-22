const fs = require("fs");
const key = fs.readFileSync("./prod-divine-firebase-service-key.json", "utf8");
const base64 = Buffer.from(key).toString('base64')