// ============================================================
// table.js — AIRTOUCH Editable Table Renderer (Excel-style)
// ============================================================

// اس وقت جو Rows Table میں دکھ رہی ہیں (Search سے Filter بھی ہو سکتی ہیں)
let displayedRows = [];

// ترتیب سے وہی Fields جن کے درمیان Tab/Enter/Arrow سے سفر ہو گا
const EDITABLE_FIELDS = ["date", "id", "amount", "phone", "message"];

// Drag سے Row اٹھاتے وقت اس کا uid یہاں رکھا جاتا ہے
let dragSrcUid = null;

// اصل rows Array میں سے uid کے ذریعے Row تلاش کرے
function findRowByUid(uid) {
  return rows.find(r => r.uid === uid);
}

// ایک Editable <tr> بنائے
function buildRow(r) {
  const office = extractOfficeFromId(r.id);
  return `
    <tr data-uid="${r.uid}">
      <td contenteditable="true" data-field="date">${r.date || "—"}</td>
      <td contenteditable="true" data-field="id" class="id-cell">${r.id}</td>
      <td contenteditable="true" data-field="amount">${r.amount !== "" ? r.amount : ""}</td>
      <td contenteditable="true" data-field="phone">${r.phone || "—"}</td>
      <td contenteditable="true" data-field="message" class="msg-cell">${r.message}</td>
      <td>${buildStatusDropdown(r)}</td>
      <td class="row-actions">
        <span class="drag-handle" draggable="true" title="Row کو کھینچ کر ترتیب بدلیں">⠿</span>
        <button class="del-row-btn" title="Row حذف کریں">✖</button>
      </td>
      <td class="office-cell">${office}</td>
    </tr>
  `;
}

// Table کو (دوبارہ) Render کرے — main.js اور search.js دونوں یہ استعمال کرتے ہیں
function renderTable(list) {
  displayedRows = list;
  const tbody = document.getElementById("tableBody");

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-msg">کوئی User ID نہیں ملی — Text چیک کریں</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(buildRow).join("");
  attachTableEvents();
}

// Render کے بعد سب Event Listeners لگائے
function attachTableEvents() {
  const tbody = document.getElementById("tableBody");

  // Editable Cells — Blur پر Save، Keydown پر Excel جیسی Navigation
  tbody.querySelectorAll("td[contenteditable]").forEach(cell => {
    cell.addEventListener("blur", () => commitCellValue(cell));
    cell.addEventListener("keydown", handleCellKeydown);
    cell.addEventListener("paste", handleCellPaste);
  });

  // Status Dropdown
  tbody.querySelectorAll(".status-select").forEach(sel => {
    sel.addEventListener("change", onStatusChange);
  });

  // Delete Row Button
  tbody.querySelectorAll(".del-row-btn").forEach(btn => {
    btn.addEventListener("click", onDeleteRow);
  });

  // Drag & Drop Row Reorder
  attachDragEvents(tbody);
}

// ============================================================
// Cell Value Save — Blur اور Paste دونوں یہی Function استعمال کرتے ہیں
// ============================================================
function commitCellValue(cell) {
  const tr = cell.closest("tr");
  const uid = Number(tr.dataset.uid);
  const field = cell.dataset.field;
  const row = findRowByUid(uid);
  if (!row) return;

  let value = cell.textContent.trim();
  if (value === "—") value = "";

  if (field === "amount") {
    row.amount = value === "" ? "" : (isNaN(value) ? value : parseInt(value));
  } else {
    row[field] = value;
  }

  if (field === "id") {
    const officeCell = tr.querySelector(".office-cell");
    if (officeCell) officeCell.textContent = extractOfficeFromId(row.id);
  }

  if (typeof updateStats === "function") updateStats(rows);
}

// ============================================================
// Excel جیسی Keyboard Navigation — Enter (نیچے)، Shift+Enter (اوپر)،
// Tab (اگلی Cell)، Shift+Tab (پچھلی Cell)، Escape (Cancel/Blur)
// ============================================================
function handleCellKeydown(e) {
  const cell = e.target;
  const tr = cell.closest("tr");
  const field = cell.dataset.field;
  const fieldIndex = EDITABLE_FIELDS.indexOf(field);

  if (e.key === "Enter") {
    e.preventDefault();
    cell.blur();
    const targetRow = e.shiftKey ? tr.previousElementSibling : tr.nextElementSibling;
    focusCell(targetRow, field);
  } else if (e.key === "Tab") {
    e.preventDefault();
    cell.blur();

    let nextIndex = fieldIndex + (e.shiftKey ? -1 : 1);
    let targetRow = tr;

    if (nextIndex < 0) {
      targetRow = tr.previousElementSibling;
      nextIndex = EDITABLE_FIELDS.length - 1;
    } else if (nextIndex >= EDITABLE_FIELDS.length) {
      targetRow = tr.nextElementSibling;
      nextIndex = 0;
    }

    if (targetRow) focusCell(targetRow, EDITABLE_FIELDS[nextIndex]);
  } else if (e.key === "Escape") {
    cell.blur();
  }
}

// دیے گئے Row میں دیے گئے Field کی Cell کو Focus کرے اور Cursor آخر میں رکھے
function focusCell(tr, field) {
  if (!tr) return;
  const cell = tr.querySelector(`td[data-field="${field}"]`);
  if (!cell) return;

  cell.focus();

  const range = document.createRange();
  range.selectNodeContents(cell);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// ============================================================
// Excel سے Copy کیا ہوا Multi-cell / Multi-row Data ایک ساتھ Paste کرے
// (اگر صرف ایک لفظ/Value ہو تو عام Paste ہونے دیں)
// ============================================================
function handleCellPaste(e) {
  const text = (e.clipboardData || window.clipboardData).getData("text");
  if (!text || (!text.includes("\t") && !text.includes("\n"))) return; // سادہ Paste — Default رہنے دیں

  e.preventDefault();

  const cell = e.target;
  const tr = cell.closest("tr");
  const startFieldIndex = EDITABLE_FIELDS.indexOf(cell.dataset.field);

  const gridRows = text
    .replace(/\r/g, "")
    .split("\n")
    .filter((line, i, arr) => !(i === arr.length - 1 && line === ""));

  let targetRow = tr;

  gridRows.forEach(lineText => {
    if (!targetRow) return;

    const cols = lineText.split("\t");
    cols.forEach((val, cIdx) => {
      const fIdx = startFieldIndex + cIdx;
      if (fIdx >= EDITABLE_FIELDS.length) return;

      const fieldName = EDITABLE_FIELDS[fIdx];
      const targetCell = targetRow.querySelector(`td[data-field="${fieldName}"]`);
      if (targetCell) {
        targetCell.textContent = val.trim();
        commitCellValue(targetCell);
      }
    });

    targetRow = targetRow.nextElementSibling;
  });
}

// ============================================================
// Drag & Drop — Row کو ⠿ Handle سے پکڑ کر اوپر نیچے کریں
// ============================================================
function attachDragEvents(tbody) {
  tbody.querySelectorAll(".drag-handle").forEach(handle => {
    handle.addEventListener("dragstart", e => {
      const tr = handle.closest("tr");
      dragSrcUid = Number(tr.dataset.uid);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(dragSrcUid));
      tr.classList.add("dragging");
    });

    handle.addEventListener("dragend", () => {
      tbody.querySelectorAll("tr.dragging").forEach(tr => tr.classList.remove("dragging"));
      tbody.querySelectorAll("tr.drag-over").forEach(tr => tr.classList.remove("drag-over"));
      dragSrcUid = null;
    });
  });

  tbody.querySelectorAll("tr[data-uid]").forEach(tr => {
    tr.addEventListener("dragover", e => {
      if (dragSrcUid === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      tr.classList.add("drag-over");
    });

    tr.addEventListener("dragleave", () => tr.classList.remove("drag-over"));

    tr.addEventListener("drop", e => {
      e.preventDefault();
      tr.classList.remove("drag-over");
      const targetUid = Number(tr.dataset.uid);
      if (dragSrcUid === null || dragSrcUid === targetUid) return;
      reorderRows(dragSrcUid, targetUid);
    });
  });
}

// اصل rows Array میں Row کو نئی جگہ منتقل کرے (Search Filter کے دوران Reorder بند رکھا جاتا ہے)
function reorderRows(srcUid, targetUid) {
  if (displayedRows.length !== rows.length) {
    alert("پہلے Search خالی کریں، پھر Rows کو Drag کر کے ترتیب دیں۔");
    return;
  }

  const srcIdx = rows.findIndex(r => r.uid === srcUid);
  if (srcIdx === -1) return;

  const [moved] = rows.splice(srcIdx, 1);
  const targetIdx = rows.findIndex(r => r.uid === targetUid);
  rows.splice(targetIdx, 0, moved);

  renderTable(rows);
}

// Row Delete کرے (اصل rows اور displayedRows دونوں سے)
function onDeleteRow(e) {
  const tr = e.target.closest("tr");
  const uid = Number(tr.dataset.uid);

  const idx = rows.findIndex(r => r.uid === uid);
  if (idx !== -1) rows.splice(idx, 1);

  const dispIdx = displayedRows.findIndex(r => r.uid === uid);
  if (dispIdx !== -1) displayedRows.splice(dispIdx, 1);

  tr.remove();

  if (typeof updateStats === "function") updateStats(rows);

  if (rows.length === 0) {
    document.getElementById("statsBar").style.display = "none";
    renderTable(rows);
  }
}
