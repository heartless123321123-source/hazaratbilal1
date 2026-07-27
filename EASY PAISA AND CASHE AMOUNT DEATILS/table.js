/**
 * table.js
 * -----------------------------------------------------------
 * Renders the "Realtime Master Spreadsheet" rows.
 * Pure rendering — receives the dataset it should show and
 * paints the <tbody>. No filtering/business logic lives here.
 * -----------------------------------------------------------
 */

const TableView = (function () {

    function render(dataset) {
        const tbody = document.getElementById("xlsxColorizedTable");
        document.getElementById("gridCounter").innerText = `${dataset.length} Records Visualized`;

        if (dataset.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="p-12 text-center text-slate-400 font-sans font-semibold">
                <i class="fa-solid fa-folder-open block text-2xl mb-2 text-slate-300"></i>No active ledger matching fields found.</td></tr>`;
            return;
        }

        let html = "";
        dataset.forEach((row, index) => {
            html += `
                <tr class="hover:bg-emerald-50/60 transition duration-700">
                    <td class="p-4 text-center font-bold text-slate-400 bg-slate-50/50">${index + 1}</td>
                    <td class="p-4 font-semibold text-slate-700">${row.date || ""} <span class="text-[10px] text-slate-400 block font-normal">${row.time || ""}</span></td>
                    <td class="p-4 font-extrabold text-slate-900">${escapeHtml(row.name)}</td>
                    <td class="p-4"><span class="bg-blue-50 text-blue-700 border border-blue-200 font-sans font-bold px-2.5 py-0.5 rounded-lg text-[11px]">${escapeHtml(row.account || "")}</span></td>
                    <td class="p-4 text-slate-600 font-extrabold"><span class="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">${escapeHtml(row.city || "")}</span></td>
                    <td class="p-4 text-[11px] text-slate-500 font-mono">${escapeHtml(row.transactionId || row.customerId || "—")}</td>
                    <td class="p-4">${statusBadge(row.status)}</td>
                    <td class="p-4 text-right font-black text-emerald-600 text-sm">Rs. ${Number(row.amount || 0).toLocaleString()}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    function statusBadge(status) {
        const s = status || "Confirmed";
        const map = {
            Duplicate: "bg-red-100 text-red-700 border-red-200 duplicate-badge",
            Confirmed: "bg-emerald-100 text-emerald-700 border-emerald-200",
            Pending: "bg-amber-100 text-amber-700 border-amber-200",
            Clear: "bg-emerald-100 text-emerald-700 border-emerald-200",
            Enable: "bg-blue-100 text-blue-700 border-blue-200",
            Done: "bg-teal-100 text-teal-700 border-teal-200",
            Checking: "bg-purple-100 text-purple-700 border-purple-200"
        };
        const cls = map[s] || "bg-slate-100 text-slate-700 border-slate-200";
        return `<span class="${cls} border px-2 py-0.5 rounded text-[10px] font-bold uppercase">${escapeHtml(s)}</span>`;
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    return { render };
})();
