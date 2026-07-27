// ============================================================
// search.js — AIRTOUCH Table Search / Filter
// ============================================================

function initSearch() {
  const input = document.getElementById("searchInput");
  if (!input) return;

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();

    if (q === "") {
      renderTable(rows);
      updateSearchCount(rows.length, rows.length);
      return;
    }

    const filtered = rows.filter(r =>
      (r.id || "").toLowerCase().includes(q) ||
      extractOfficeFromId(r.id).toLowerCase().includes(q) ||
      (r.phone || "").toLowerCase().includes(q) ||
      (r.message || "").toLowerCase().includes(q) ||
      (r.status || "").toLowerCase().includes(q) ||
      String(r.amount || "").includes(q)
    );

    renderTable(filtered);
    updateSearchCount(filtered.length, rows.length);
  });
}

// "X / Y Records نظر آ رہے ہیں" دکھائے
function updateSearchCount(shown, total) {
  const box = document.getElementById("searchCount");
  if (!box) return;

  box.textContent = (total === 0 || shown === total)
    ? ""
    : `${shown} / ${total} Records نظر آ رہے ہیں`;
}

document.addEventListener("DOMContentLoaded", initSearch);
