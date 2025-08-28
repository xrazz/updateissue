# 🛠️ UpdateIssue SDK  

![npm version](https://img.shields.io/npm/v/updateissue)
![npm downloads](https://img.shields.io/npm/dm/updateissue)
![License: Apache-2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen)

**UpdateIssue** is a lightweight JavaScript/Node.js SDK that helps you **monitor and report service failures** in projects that run on autopilot.  

It’s designed to keep you awake when things break — whether it’s an AI chatbot running out of credits, a failed payment attempt, an API outage, or any other unexpected error in your application.  

With just **one line of code inside `catch`**, you can instantly report issues to your backend and trigger alerts (Discord, Slack, Email, PagerDuty, etc.).

---

## ✨ Features

- 🚨 **One-liner error reporting** (drop inside `catch`)
- 🌍 Works in **both Node.js and Browser**
- 🔍 Automatically captures **stack traces, file name, function name, and line number**
- ⚡ Send errors to **your backend webhook** for processing
- 🔔 Use cases:  
  - AI chatbots running out of credits  
  - Payment failures (Stripe, Razorpay, PayPal, etc.)  
  - Database connection issues  
  - API downtime (e.g. `fetch` failing)  
  - Background job failures  
  - Any custom service that must stay healthy  

---

## 📦 Installation

### From GitHub
```bash
npm install github:your-username/updateissue
```

### From NPM (recommended, once published)
```bash
npm install updateissue
```

---

## 🚀 Usage

### Basic Example (Node.js / Browser)

```javascript
import { reportIssue } from "updateissue";

try {
  // your code that may fail
  throw new Error("Payment gateway timeout");
} catch (error) {
  await reportIssue(error, {
    service: "Payment Service",
    metadata: { userId: 123, orderId: "ORD-456" },
  });
}
```

### With Async Function

```javascript
import { reportIssue } from "updateissue";

async function main() {
  try {
    const response = await fetch("https://api.example.com/data");
    if (!response.ok) throw new Error("API request failed");
  } catch (error) {
    await reportIssue(error, {
      service: "Data Fetcher",
      metadata: { endpoint: "/data", retry: false },
    });
  }
}

main();
```

---

## ⚙️ Configuration

You can pass extra context in the `reportIssue` call:

```javascript
await reportIssue(error, {
  service: "My AI Bot",
  metadata: {
    user: "rajtripathi",
    plan: "Pro",
    creditsLeft: 0,
  },
});
```

This will be sent as JSON to your backend/webhook:

```json
{
  "message": "My AI Bot: Error: No credits left",
  "stack": "Error: No credits left\n   at ...",
  "service": "My AI Bot",
  "metadata": {
    "user": "rajtripathi",
    "plan": "Pro",
    "creditsLeft": 0
  }
}
```

---

## 🛠️ Backend Example (Express.js)

Here’s a quick Express.js server that receives issues:

```javascript
import express from "express";

const app = express();
app.use(express.json());

app.post("/report", (req, res) => {
  console.log("Issue reported:", req.body);

  // TODO: forward to Slack, Discord, Email, PagerDuty, etc.
  res.send({ status: "ok" });
});

app.listen(3000, () => console.log("Listening on http://localhost:3000"));
```

---

## 🔔 Integrations

You can connect your backend to:

* Slack / Discord (send messages to channels)
* Email (via Nodemailer, SES, SendGrid)
* PagerDuty / OpsGenie (on-call alerts)
* SMS (via Twilio, etc.)

---

## 📌 Roadmap

- [ ] Native Slack & Discord integration  
- [ ] Built-in retry logic  
- [ ] TypeScript definitions  
- [ ] In-browser dashboard for error history  

---

## 🤝 Contributing

1. Fork the repo  
2. Create a new branch (`feature/my-feature`)  
3. Commit changes  
4. Open a PR 🎉  

---

## 📄 License

```
Apache License 2.0

Copyright (c) 2025 Raj Tripathi

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
