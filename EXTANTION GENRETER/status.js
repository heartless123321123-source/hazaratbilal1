// ============================================================
// status.js — AIRTOUCH Row Status Dropdown
// ============================================================

// Message میں موجود لفظ کی بنیاد پر یہی Statuses بنتے ہیں
// (دیکھیں parser.js میں detectStatus)
const STATUS_OPTIONS = ["Pending", "Clear", "Enable", "Done", "Checking"];

// ایک Row کے لیے Status Dropdown کا HTML بنائے
function buildStatusDropdown(r) {
  if (!r.status) r.status = "Pending";

  const options = STATUS_OPTIONS.map(opt =>
    `<option value="${opt}" ${r.status === opt ? "selected" : ""}>${opt}</option>`
  ).join("");

  return `<select class="status-select status-${r.status.toLowerCase()}">${options}</select>`;
}

// Dropdown بدلنے پر اصل Row Update کرے
function onStatusChange(e) {
  const sel = e.target;
  const tr = sel.closest("tr");
  const uid = Number(tr.dataset.uid);
  const row = findRowByUid(uid);
  if (!row) return;

  row.status = sel.value;
  sel.className = "status-select status-" + sel.value.toLowerCase();
}
