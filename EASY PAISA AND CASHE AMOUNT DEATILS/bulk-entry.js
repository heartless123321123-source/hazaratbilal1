/**
 * bulk-entry.js
 * -----------------------------------------------------------
 * UI controller for the "📋 Paste WhatsApp Log" modal.
 * Flow: Paste text → Parse Data → review/edit the preview
 * table (status dropdown, delete row) → "Save All to Ledger"
 * writes every row into the SAME IndexedDB store used by
 * Manual Entry / Scan Screenshot, so it shows up in the main
 * table, dashboard, filters and Excel export automatically.
 * -----------------------------------------------------------
 */

const BulkEntry = (function () {

    let parsedRows = [];   // full parsed set
    let shownRows = [];    // currently visible (after in-modal search)

    function el(id) { return document.getElementById(id); }

    function openModal() {
        el("bulkModal").classList.remove("hidden");
    }

    function closeModal() {
        el("bulkModal").classList.add("hidden");
    }

    function findRowByUid(uid) {
        return parsedRows.find(r => r.uid === uid);
    }

    /* ---------------- Parse / Clear ---------------- */

    function handleParse() {
        const raw = el("bulkRawInput").value.trim();
        if (!raw) {
            alert("پہلے Text Paste کریں!");
            return;
        }

        parsedRows = BulkParser.parseLog(raw);
        if (el("bulkSearchInput")) el("bulkSearchInput").value = "";
        renderPreview(parsedRows);
        updateStats(parsedRows);
    }

    function handleClear() {
        el("bulkRawInput").value = "";
        parsedRows = [];
        if (el("bulkSearchInput")) el("bulkSearchInput").value = "";
        el("bulkTableBody").innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-400 font-semibold text-xs">Data Paste کریں اور Parse بٹن دبائیں</td></tr>`;
        el("bulkStatsBar").classList.add("hidden");
    }

    /* ---------------- Stats ---------------- */

    function updateStats(rows) {
        const withAmt = rows.filter(r => r.amount !== "").length;
        el("bulkTotalCount").innerText = rows.length;
        el("bulkWithAmount").innerText = withAmt;
        el("bulkNoAmount").innerText = rows.length - withAmt;
        el("bulkStatsBar").classList.toggle("hidden", rows.length === 0);
    }

    /* ---------------- Preview table ---------------- */

    function statusClasses(status) {
        const map = {
            Pending: "bg-amber-100 text-amber-700 border-amber-200",
            Clear: "bg-emerald-100 text-emerald-700 border-emerald-200",
            Enable: "bg-blue-100 text-blue-700 border-blue-200",
            Done: "bg-teal-100 text-teal-700 border-teal-200",
            Checking: "bg-purple-100 text-purple-700 border-purple-200"
        };
        return map[status] || "bg-slate-100 text-slate-700 border-slate-200";
    }

    function buildStatusDropdown(r) {
        if (!r.status) r.status = "Pending";
        const options = BulkParser.STATUS_OPTIONS.map(opt =>
            `<option value="${opt}" ${r.status === opt ? "selected" : ""}>${opt}</option>`
        ).join("");
        return `<select data-uid="${r.uid}" class="bulk-status-select text-[10px] font-bold border rounded-lg px-2 py-1 ${statusClasses(r.status)}">${options}</select>`;
    }

    function buildRow(r) {
        const office = BulkParser.extractOfficeFromId(r.id);
        return `
            <tr data-uid="${r.uid}" class="hover:bg-emerald-50/60 transition">
                <td contenteditable="true" data-field="date" class="p-3 text-[11px] font-semibold text-slate-700 whitespace-nowrap">${r.date || "—"}</td>
                <td contenteditable="true" data-field="id" class="p-3 text-[11px] font-mono font-bold text-blue-700">${r.id}</td>
                <td contenteditable="true" data-field="amount" class="p-3 text-[11px] font-black text-emerald-600">${r.amount !== "" ? r.amount : ""}</td>
                <td contenteditable="true" data-field="phone" class="p-3 text-[11px] text-slate-600">${r.phone || "—"}</td>
                <td contenteditable="true" data-field="message" class="p-3 text-[11px] text-slate-600 max-w-xs truncate">${r.message}</td>
                <td class="p-3">${buildStatusDropdown(r)}</td>
                <td class="p-3 text-center">
                    <button class="bulk-del-btn text-red-400 hover:text-red-600" data-uid="${r.uid}" title="Row حذف کریں"><i class="fa-solid fa-circle-xmark"></i></button>
                </td>
                <td class="p-3 text-[10px] font-bold text-slate-500">${office}</td>
            </tr>
        `;
    }

    function renderPreview(list) {
        shownRows = list;
        const tbody = el("bulkTableBody");

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-400 font-semibold text-xs">کوئی User ID نہیں ملی — Text چیک کریں</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(buildRow).join("");
        attachRowEvents();
    }

    function attachRowEvents() {
        const tbody = el("bulkTableBody");

        tbody.querySelectorAll("td[contenteditable]").forEach(cell => {
            cell.addEventListener("blur", onCellEdit);
            cell.addEventListener("keydown", (e) => {
                if (e.key === "Enter") { e.preventDefault(); cell.blur(); }
            });
        });

        tbody.querySelectorAll(".bulk-status-select").forEach(sel => {
            sel.addEventListener("change", (e) => {
                const uid = Number(e.target.dataset.uid);
                const row = findRowByUid(uid);
                if (!row) return;
                row.status = e.target.value;
                e.target.className = "bulk-status-select text-[10px] font-bold border rounded-lg px-2 py-1 " + statusClasses(row.status);
            });
        });

        tbody.querySelectorAll(".bulk-del-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const uid = Number(e.currentTarget.dataset.uid);
                parsedRows = parsedRows.filter(r => r.uid !== uid);
                shownRows = shownRows.filter(r => r.uid !== uid);
                e.currentTarget.closest("tr").remove();
                updateStats(parsedRows);
            });
        });
    }

    function onCellEdit(e) {
        const cell = e.target;
        const uid = Number(cell.closest("tr").dataset.uid);
        const field = cell.dataset.field;
        const row = findRowByUid(uid);
        if (!row) return;

        let value = cell.textContent.trim();
        if (value === "—") value = "";

        row[field] = (field === "amount") ? (value === "" ? "" : (isNaN(value) ? value : parseInt(value))) : value;
        updateStats(parsedRows);
    }

    /* ---------------- In-modal search ---------------- */

    function handleSearch() {
        const q = (el("bulkSearchInput").value || "").trim().toLowerCase();
        if (q === "") {
            renderPreview(parsedRows);
            return;
        }
        const filtered = parsedRows.filter(r =>
            (r.id || "").toLowerCase().includes(q) ||
            BulkParser.extractOfficeFromId(r.id).toLowerCase().includes(q) ||
            (r.phone || "").toLowerCase().includes(q) ||
            (r.message || "").toLowerCase().includes(q) ||
            (r.status || "").toLowerCase().includes(q) ||
            String(r.amount || "").includes(q)
        );
        renderPreview(filtered);
    }

    /* ---------------- Batch actions ---------------- */

    function downloadBatchExcel() {
        if (typeof XLSX === "undefined") {
            alert("Excel engine (SheetJS) not loaded — check your internet connection.");
            return;
        }
        if (parsedRows.length === 0) {
            alert("کوئی Data نہیں ہے Download کرنے کے لیے!");
            return;
        }

        const data = [["Date/Time", "User ID", "Amount", "Phone", "Full Message", "Status", "Office"]];
        parsedRows.forEach(r => {
            data.push([r.date || "", r.id || "", r.amount || "", r.phone || "", r.message || "", r.status || "Pending", BulkParser.extractOfficeFromId(r.id)]);
        });

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws["!cols"] = [{ wch: 22 }, { wch: 15 }, { wch: 10 }, { wch: 25 }, { wch: 60 }, { wch: 12 }, { wch: 12 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Recharge Data");
        XLSX.writeFile(wb, "AIRTOUCH_Recharge_" + new Date().toISOString().slice(0, 10) + ".xlsx");
    }

    /** Push every parsed row into the SAME ledger IndexedDB used by Manual/Scan entry */
    async function saveAllToLedger() {
        if (parsedRows.length === 0) {
            alert("کوئی Data نہیں ہے Save کرنے کے لیے!");
            return;
        }

        const noAmountCount = parsedRows.filter(r => r.amount === "").length;
        if (noAmountCount > 0) {
            const proceed = confirm(`${noAmountCount} rows میں Amount نہیں ملا — پھر بھی Rs. 0 کے ساتھ Save کریں؟`);
            if (!proceed) return;
        }

        await EntryManager.commitBulkEntries(parsedRows);
        alert(`${parsedRows.length} Records Ledger میں Save ہو گئے۔`);
        closeModal();
        handleClear();
    }

    function wireEvents() {
        el("bulkParseBtn").addEventListener("click", handleParse);
        el("bulkClearBtn").addEventListener("click", handleClear);
        el("bulkDownloadBtn").addEventListener("click", downloadBatchExcel);
        el("bulkSaveLedgerBtn").addEventListener("click", saveAllToLedger);
        if (el("bulkSearchInput")) el("bulkSearchInput").addEventListener("input", handleSearch);
    }

    return { openModal, closeModal, wireEvents };
})();
