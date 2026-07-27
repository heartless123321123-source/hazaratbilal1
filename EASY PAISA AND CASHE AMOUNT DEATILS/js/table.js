/**
 * table.js
 * -----------------------------------------------------------
 * Renders the "Realtime Master Spreadsheet" rows using the
 * new column layout:
 *   Date | Time | Recipient Name | Amount | Transaction ID |
 *   User ID | Account Name | Checked | Bill Month/Notes |
 *   Sender Number
 *
 * Every cell (except Index/Checked) is contenteditable —
 * edits are saved straight back to IndexedDB via
 * EntryManager.updateField() on blur / change.
 * -----------------------------------------------------------
 */

const TableView = (function () {

    const EDITABLE_FIELDS = [
        "date", "time", "recipientName", "amount", "transactionId",
        "userId", "accountName", "city", "billNotes", "senderNumber"
    ];

    function render(dataset) {
        const tbody = document.getElementById("xlsxColorizedTable");
        document.getElementById("gridCounter").innerText = `${dataset.length} Records Visualized`;

        if (dataset.length === 0) {
            tbody.innerHTML = `<tr><td colspan="13" class="p-12 text-center text-slate-400 font-sans font-semibold">
                <i class="fa-solid fa-folder-open block text-2xl mb-2 text-slate-300"></i>No active ledger matching fields found.</td></tr>`;
            return;
        }

        let html = "";
        dataset.forEach((row, index) => {
            html += `
                <tr class="hover:bg-emerald-50/60 transition duration-700" data-id="${row.id}">
                    <td class="p-3 text-center bg-slate-50/50">
                        <button class="row-delete-btn text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-md w-6 h-6 inline-flex items-center justify-center transition" title="Delete row">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </td>
                    <td class="p-3 text-center font-bold text-slate-400 bg-slate-50/50">${index + 1}</td>
                    <td class="p-3" contenteditable="true" data-field="date">${escapeHtml(row.date)}</td>
                    <td class="p-3" contenteditable="true" data-field="time">${escapeHtml(row.time)}</td>
                    <td class="p-3 font-extrabold text-slate-900" contenteditable="true" data-field="recipientName">${escapeHtml(row.recipientName)}</td>
                    <td class="p-3 text-right font-black text-emerald-600" contenteditable="true" data-field="amount">${Number(row.amount || 0).toLocaleString()}</td>
                    <td class="p-3 font-mono text-[11px]" contenteditable="true" data-field="transactionId">${escapeHtml(row.transactionId)}</td>
                    <td class="p-3 font-mono text-[11px]" contenteditable="true" data-field="userId">${escapeHtml(row.userId)}</td>
                    <td class="p-3" contenteditable="true" data-field="accountName"><span class="bg-blue-50 text-blue-700 border border-blue-200 font-sans font-bold px-2 py-0.5 rounded text-[11px]">${escapeHtml(row.accountName)}</span></td>
                    <td class="p-3" contenteditable="true" data-field="city"><span class="bg-amber-50 text-amber-700 border border-amber-200 font-sans font-bold px-2 py-0.5 rounded text-[11px]">${escapeHtml(row.city)}</span></td>
                    <td class="p-3 text-center"><input type="checkbox" class="row-checked-box w-4 h-4 accent-emerald-600 cursor-pointer" ${row.checked ? "checked" : ""}></td>
                    <td class="p-3 text-[11px]" contenteditable="true" data-field="billNotes">${escapeHtml(row.billNotes)}</td>
                    <td class="p-3 text-[11px]" contenteditable="true" data-field="senderNumber">${escapeHtml(row.senderNumber)}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        attachEditHandlers(tbody);
    }

    function attachEditHandlers(tbody) {
        tbody.querySelectorAll("td[contenteditable]").forEach(cell => {
            cell.addEventListener("blur", onCellBlur);
            cell.addEventListener("keydown", (e) => {
                if (e.key === "Enter") { e.preventDefault(); cell.blur(); }
            });
        });

        tbody.querySelectorAll(".row-checked-box").forEach(box => {
            box.addEventListener("change", onCheckedChange);
        });

        tbody.querySelectorAll(".row-delete-btn").forEach(btn => {
            btn.addEventListener("click", onDeleteClick);
        });
    }

    function onDeleteClick(e) {
        const tr = e.target.closest("tr");
        const id = Number(tr.dataset.id);
        if (confirm("Ye row delete karna chahte hain? Ye wapas nahi aayegi.")) {
            EntryManager.deleteRecord(id);
        }
    }

    function onCellBlur(e) {
        const cell = e.target;
        const tr = cell.closest("tr");
        const id = Number(tr.dataset.id);
        const field = cell.dataset.field;
        if (!EDITABLE_FIELDS.includes(field)) return;

        let value = cell.textContent.trim();
        if (field === "amount") value = Number(value.replace(/,/g, "")) || 0;

        EntryManager.updateField(id, field, value);
    }

    function onCheckedChange(e) {
        const tr = e.target.closest("tr");
        const id = Number(tr.dataset.id);
        EntryManager.updateField(id, "checked", e.target.checked);
    }

    function escapeHtml(str) {
        if (str === undefined || str === null) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    return { render };
})();
