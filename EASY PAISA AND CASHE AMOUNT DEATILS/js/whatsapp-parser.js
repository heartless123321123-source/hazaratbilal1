/**
 * whatsapp-parser.js
 * -----------------------------------------------------------
 * Ported from the "Hazrat Bilal Accountant" WhatsApp log parser
 * (settings.js + parser.js), namespaced under BulkParser so it
 * can live inside the same page as the rest of the Ledger app
 * without clashing with table.js / search.js / app.js globals.
 *
 * Turns a pasted WhatsApp chat export into structured rows:
 *   { uid, id, amount, phone, date, message, status }
 * -----------------------------------------------------------
 */

const BulkParser = (function () {

    const SETTINGS = {
        // تمام City Prefixes — بڑے اور چھوٹے دونوں
        validPrefixes: [
            "B", "BTK", "KHR", "MKD", "CKD", "ZRT", "NSF", "BKD", "TLS",
            "KOT", "SHM", "MTA", "TLG", "MGL", "SNG", "SWT", "BKT", "ODG",
            "MNR", "GHL", "OSK", "BDN", "KDZ", "TOK", "MBD", "SKT", "OCH",
            "DHR", "TDC", "KML", "THA", "ALD", "QLG", "TNG", "CKT", "SLW",
            "KKL", "FTR", "BGR"
        ],
        // یہ الفاظ User ID نہیں ہیں — Ignore ہوں گے
        ignoreWords: [
            "MB", "GB", "KB", "TB", "G",
            "RS", "PKG", "PLAN", "SPEED",
            "PAYMENT", "RECHARGE", "BILL",
            "DONE", "PHOTO", "CLEAR",
            "NET", "DATA", "INVOICE",
            "LOGIN", "USER", "WIFI"
        ],
        // صحیح Amount Values — صرف یہی amounts valid ہیں
        validAmounts: [
            1200, 1500, 1700, 2000, 2100,
            2400, 2500, 3000, 3500,
            4000, 4200, 8400
        ]
    };

    const STATUS_OPTIONS = ["Pending", "Clear", "Enable", "Done", "Checking"];

    function stripPrefix(rawLine) {
        const line = rawLine
            .replace(/[\u200E\u200F\u200B\uFEFF\u2066\u2067\u2068\u2069]/g, "")
            .replace(/\u202F/g, " ");

        // iPhone Format: [9:15 AM, 7/12/2026] Sender: text
        let m = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?\s?[APap][Mm],\s*\d{1,2}\/\d{1,2}\/\d{2,4})\]\s*(.+?):\s*(.*)$/);
        if (m) return { date: m[1].trim(), phone: m[2].trim(), text: m[3].trim() };

        // Android Format: 6/12/26, 3:11 PM - Sender: text
        m = line.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap][Mm])?)\s*-\s*(.+?):\s*(.*)$/);
        if (m) return { date: m[1].trim(), phone: m[2].trim(), text: m[3].trim() };

        // Legacy/fallback bracket format
        m = line.match(/^\[(.*?)\]\s*(.+?):\s*(.*)$/);
        if (m) return { date: m[1].trim(), phone: m[2].trim(), text: m[3].trim() };

        return { date: "", phone: "", text: line.trim() };
    }

    function extractIds(text) {
        const ids = [];
        const unique = new Set();
        const regex = /\b([A-Za-z]{1,5})\s*(\d{1,4})\b/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
            const prefix = match[1].toUpperCase();
            const number = match[2];
            const fullID = prefix + number;

            if (SETTINGS.ignoreWords.includes(prefix)) continue;
            if (["MB", "GB", "KB"].includes(prefix)) continue;
            if (SETTINGS.validAmounts.includes(parseInt(number))) continue;

            if (SETTINGS.validPrefixes.includes(prefix)) {
                const id = fullID.toLowerCase();
                if (!unique.has(id)) {
                    unique.add(id);
                    ids.push(id);
                }
            }
        }
        return ids;
    }

    function extractOfficeFromId(id) {
        const m = String(id || "").match(/^([a-z]+)/i);
        return m ? m[1].toUpperCase() : "";
    }

    function detectStatus(message) {
        const text = String(message || "").toLowerCase();
        if (text.includes("clear")) return "Clear";
        if (text.includes("enable")) return "Enable";
        if (text.includes("done")) return "Done";
        if (text.includes("check")) return "Checking";
        if (text.includes("pending")) return "Pending";
        return "Pending";
    }

    function extractAmount(text) {
        const nums = text.match(/\d+/g);
        if (!nums) return "";
        for (const n of nums) {
            const value = parseInt(n);
            if (SETTINGS.validAmounts.includes(value)) return value;
        }
        return "";
    }

    function saveMessage(rows, phone, date, message) {
        const ids = extractIds(message);
        if (ids.length === 0) return;

        const amount = extractAmount(message);
        const status = detectStatus(message);

        ids.forEach(id => {
            const exists = rows.find(r => r.id === id && r.phone === phone && r.message === message);
            if (!exists) rows.push({ id, amount, phone, date, message, status });
        });
    }

    function parseLog(rawText) {
        const rows = [];
        const lines = rawText.split(/\r?\n/);

        let currentPhone = "", currentDate = "", currentMessage = "", hasCurrent = false;

        function flush() {
            if (hasCurrent && currentMessage.trim() !== "") {
                saveMessage(rows, currentPhone, currentDate, currentMessage.trim());
            }
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === "") continue;

            const data = stripPrefix(line);

            if (data.date !== "" || data.phone !== "") {
                flush();
                currentPhone = data.phone;
                currentDate = data.date;
                currentMessage = data.text;
                hasCurrent = true;
            } else if (hasCurrent) {
                currentMessage += " " + line;
            }
        }
        flush();

        rows.forEach((r, i) => { r.uid = i; });
        return rows;
    }

    return { parseLog, extractOfficeFromId, STATUS_OPTIONS, SETTINGS };
})();
