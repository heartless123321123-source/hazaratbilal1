// ============================================================
// parser.js — AIRTOUCH Recharge Parser Logic
// ============================================================

// WhatsApp یا Plain Text سے Date/Phone/Text نکالے
function stripPrefix(rawLine) {
  // اصل Export Files میں اکثر invisible/hidden characters ہوتے ہیں
  // (LRM, RLM, ZWSP, BOM, directional isolate marks) — پہلے یہ صاف کریں
  const line = rawLine
    .replace(/[\u200E\u200F\u200B\uFEFF\u2066\u2067\u2068\u2069]/g, "")
    .replace(/\u202F/g, " ");

  // iPhone Format: [9:15 AM, 7/12/2026] Sender: text
  let m = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?\s?[APap][Mm],\s*\d{1,2}\/\d{1,2}\/\d{2,4})\]\s*(.+?):\s*(.*)$/);
  if (m) {
    return { date: m[1].trim(), phone: m[2].trim(), text: m[3].trim() };
  }

  // Android Format: 6/12/26, 3:11 PM - Sender: text  (AM/PM بھی optional، 24hr بھی چلے گا)
  m = line.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap][Mm])?)\s*-\s*(.+?):\s*(.*)$/);
  if (m) {
    return { date: m[1].trim(), phone: m[2].trim(), text: m[3].trim() };
  }

  // Legacy/غیر معروف bracket format — fallback
  m = line.match(/^\[(.*?)\]\s*(.+?):\s*(.*)$/);
  if (m) {
    return { date: m[1].trim(), phone: m[2].trim(), text: m[3].trim() };
  }

  return { date: "", phone: "", text: line.trim() };
}

// Text سے User IDs نکالے
function extractIds(text) {
  const ids = [];
  const unique = new Set();

  // اصل AIRTOUCH IDs:
  // Ald618, Ckd421, Dhr55, Tok40, Tha922
  const regex = /\b([A-Za-z]{1,5})\s*(\d{1,4})\b/g;

  let match;

  while ((match = regex.exec(text)) !== null) {

    let prefix = match[1].toUpperCase();
    let number = match[2];

    const fullID = prefix + number;

    // Ignore words
    if (SETTINGS.ignoreWords.includes(prefix)) continue;

    // Package values ignore
    if (["MB", "GB", "KB"].includes(prefix)) continue;

    // Amount کو ID نہ بننے دیں
    if (SETTINGS.validAmounts.includes(parseInt(number))) continue;

    // صرف AIRTOUCH prefixes allow
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

// ID سے Office نکالے — مثلاً "kot123" سے "KOT", "b0111" سے "B"
function extractOfficeFromId(id) {
  const m = String(id || "").match(/^([a-z]+)/i);
  return m ? m[1].toUpperCase() : "";
}

// Message کے اندر موجود لفظ سے Status پہچانے
// Clear / Pending / Enable / Done / Checking
function detectStatus(message) {
  const text = String(message || "").toLowerCase();

  if (text.includes("clear")) return "Clear";
  if (text.includes("enable")) return "Enable";
  if (text.includes("done")) return "Done";
  if (text.includes("check")) return "Checking";
  if (text.includes("pending")) return "Pending";

  return "Pending";
}

// Text سے Amount نکالے
function extractAmount(text) {
  const nums = text.match(/\d+/g);
  if (!nums) return "";
  for (let n of nums) {
    let value = parseInt(n);
    if (SETTINGS.validAmounts.includes(value)) return value;
  }
  return "";
}

// ایک Message محفوظ کرے
function saveMessage(rows, phone, date, message) {
  const ids = extractIds(message);
  if (ids.length === 0) return;

  const amount = extractAmount(message);
  const status = detectStatus(message);

  ids.forEach(id => {
    const exists = rows.find(r =>
      r.id === id && r.phone === phone && r.message === message
    );
    if (!exists) {
      rows.push({ id, amount, phone, date, message, status });
    }
  });
}

// مین Parse Function
function parseLog(rawText) {
  const rows = [];
  const lines = rawText.split(/\r?\n/);

  let currentPhone = "";
  let currentDate = "";
  let currentMessage = "";
  let hasCurrent = false;

  function flush() {
    if (hasCurrent && currentMessage.trim() !== "") {
      saveMessage(rows, currentPhone, currentDate, currentMessage.trim());
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") continue;

    const data = stripPrefix(line);

    // اگر Line میں پہچانی گئی Date/Phone موجود ہے تو یہ نئے Message کی شروعات ہے
    if (data.date !== "" || data.phone !== "") {
      flush();
      currentPhone = data.phone;
      currentDate = data.date;
      currentMessage = data.text;
      hasCurrent = true;
    } else if (hasCurrent) {
      // یہ پچھلے Message کا تسلسل (Multi-line Message) ہے
      currentMessage += " " + line;
    }
    // اگر کوئی بھی Message شروع نہیں ہوا اور Prefix بھی نہیں ملا تو یہ Line چھوڑ دیں
  }

  flush();

  // ہر Row کو Unique ID (uid) دیں — Edit/Delete/Status کے لیے ضروری
  rows.forEach((r, i) => {
    r.uid = i;
  });

  return rows;
}
