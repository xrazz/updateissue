"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueUpdate = issueUpdate;
const cross_fetch_1 = __importDefault(require("cross-fetch"));
/**
 * Sends issue updates to your backend webhook.
 * @param apiKey - The user's API key
 * @param event - The event name, e.g. "checkout.calculateTotals"
 * @param err - Error object or message
 * @param data - Extra data like { notifier: "discord" }
 */
async function issueUpdate(apiKey, event, err, data = {}) {
    const url = "https://your-backend.com/webhook";
    // Ensure we have an Error object to grab stack info
    const errorObj = err instanceof Error ? err : new Error(String(err));
    const stackLines = (errorObj.stack || "").split("\n");
    // Extract caller info (file, function, line, column)
    const callerInfo = stackLines[1] || "";
    const match = callerInfo.match(/\s*at\s+(.*?)\s+\((.*):(\d+):(\d+)\)/);
    let functionName = null, fileName = null, line = null, col = null;
    if (match) {
        functionName = match[1];
        fileName = match[2];
        line = match[3];
        col = match[4];
    }
    const payload = {
        event,
        error: errorObj.message,
        stack: errorObj.stack,
        file: fileName,
        function: functionName,
        line,
        col,
        data,
        timestamp: new Date().toISOString(),
    };
    console.log("Reporting issue:", payload);
    try {
        const response = await (0, cross_fetch_1.default)(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }
        return await response.json();
    }
    catch (reportErr) {
        console.error("Issue update failed:", reportErr);
        // Don't throw, otherwise it will crash the user app
    }
}
