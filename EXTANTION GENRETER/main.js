// ============================================================
// main.js — AIRTOUCH Recharge Parser UI Controller
// ============================================================

let rows = [];

// ------------------------------------------------------------
// Extension Handoff — jab yeh page WhatsApp Extension (side panel)
// ke "Send to Accountant" button se khula ho, to chrome.storage.local
// me "wa_accountant_handoff" key ke andar raw text pada hoga.
// Yahan usay uthaya jaye, rawInput me daala jaye, aur khud parse kiya jaye.
// ------------------------------------------------------------
function receiveExtensionHandoff() {
  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
    // Standalone browser page (extension ke bahar) — kuch nahi karna
    return;
  }

  chrome.storage.local.get("wa_accountant_handoff", (result) => {
    const handoff = result && result.wa_accountant_handoff;
    if (!handoff || !handoff.text || !handoff.text.trim()) {
      setReceiveStatus("🟢 WhatsApp Extension کا Data منتظر...");
      return;
    }

    setReceiveStatus("📥 Data وصول ہو رہا ہے...");

    const rawInput = document.getElementById("rawInput");
    rawInput.value = handoff.text;

    rows = parseLog(handoff.text);
    resetSearchBox();
    renderTable(rows);
    updateStats(rows);

    setReceiveStatus(`✅ ${rows.length} Records وصول ہوئے (Extension سے)`);

    // ایک بار use ہونے کے بعد ہٹا دیں تاکہ اگلی بار page reload پر دوبارہ نہ چلے
    chrome.storage.local.remove("wa_accountant_handoff");
  });
}

function setReceiveStatus(text) {
  const el = document.getElementById("receiveStatus");
  if (el) el.textContent = text;
}

// Parse Button
document.getElementById("parseBtn").onclick = function () {
  const raw = document.getElementById("rawInput").value.trim();
  if (!raw) {
    alert("پہلے Text Paste کریں!");
    return;
  }

  rows = parseLog(raw);

  resetSearchBox();
  renderTable(rows);
  updateStats(rows);
};

// Download Button
document.getElementById("downloadBtn").onclick = function () {
  downloadExcel(rows);
};

// Clear Button
document.getElementById("clearBtn").onclick = function () {
  document.getElementById("rawInput").value = "";
  rows = [];

  resetSearchBox();

  document.getElementById("tableBody").innerHTML = `
    <tr><td colspan="8" class="empty-msg">Data Paste کریں اور Parse بٹن دبائیں</td></tr>
  `;
  document.getElementById("statsBar").style.display = "none";
};

// Search Box کو خالی کرے (Parse/Clear کے بعد)
function resetSearchBox() {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";

  const countBox = document.getElementById("searchCount");
  if (countBox) countBox.textContent = "";
}

// Stats Update
function updateStats(rows) {
  const withAmt = rows.filter(r => r.amount !== "").length;
  document.getElementById("totalCount").textContent = rows.length;
  document.getElementById("withAmount").textContent = withAmt;
  document.getElementById("noAmount").textContent = rows.length - withAmt;
  document.getElementById("statsBar").style.display = rows.length > 0 ? "flex" : "none";
}

// Page load hote hi check karo ke Extension se koi handoff data aaya hai
receiveExtensionHandoff();
