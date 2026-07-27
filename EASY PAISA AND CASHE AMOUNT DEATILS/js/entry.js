/**
 * entry.js
 * -----------------------------------------------------------
 * Builds a ledger record (manual entry), runs duplicate check,
 * saves it to IndexedDB (database.js), then asks app.js to
 * refresh the in-memory dataset + UI. Also handles saving
 * inline edits made directly in the Master Spreadsheet table.
 *
 * Record shape (new header layout):
 *   { id, date, time, recipientName, amount, transactionId,
 *     userId, accountName, city, checked, billNotes, senderNumber,
 *     createdTime }
 *
 * City is a plain optional entry field here (Save & Post Entry does
 * not block on it). The actual City filter/validation lives in the
 * "Side Audit Router" sidebar (cityPicker), same pattern as Account.
 * -----------------------------------------------------------
 */

const EntryManager = (function () {

    function el(id) { return document.getElementById(id); }

    function todayStamp() {
        const today = new Date();
        const date = String(today.getDate()).padStart(2, '0') + '-' +
            String(today.getMonth() + 1).padStart(2, '0') + '-' +
            today.getFullYear();
        const time = today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return { date, time };
    }

    /** Manual entry — triggered by "Save & Post Entry" button */
    async function commitManualEntry() {
        const name = el("formName").value.trim();
        const account = el("formAccount").value;
        const city = el("formCity") ? el("formCity").value : "";
        const amountRaw = el("formAmount").value.trim();
        const amountVal = amountRaw === "" ? 0 : parseFloat(amountRaw);

        // Nothing typed anywhere? Nothing to save.
        const anyFieldFilled = name || amountRaw || el("formTxnId").value.trim() ||
            el("formUserId").value.trim() || el("formBillNotes").value.trim() ||
            el("formSenderNumber").value.trim();
        if (!anyFieldFilled) {
            alert("Kam az kam ek field bharein save karne ke liye.");
            return;
        }

        const stamp = todayStamp();

        const record = {
            date: stamp.date,
            time: stamp.time,
            recipientName: name,
            amount: isNaN(amountVal) ? 0 : amountVal,
            transactionId: el("formTxnId") ? el("formTxnId").value.trim() : "",
            userId: el("formUserId") ? el("formUserId").value.trim() : "",
            accountName: account,
            city: city,
            checked: false,
            billNotes: el("formBillNotes") ? el("formBillNotes").value.trim() : "",
            senderNumber: el("formSenderNumber") ? el("formSenderNumber").value.trim() : "",
            createdTime: new Date().toISOString()
        };

        const saved = await saveRecord(record);
        if (!saved) return;

        ["formName", "formAmount", "formTxnId", "formUserId", "formBillNotes", "formSenderNumber"]
            .forEach(id => { if (el(id)) el(id).value = ""; });
        if (el("formCity")) el("formCity").value = "";
    }

    async function saveRecord(record) {
        // Duplicate guard on Transaction ID
        if (record.transactionId) {
            const matches = await LedgerDB.findByTransactionId(record.transactionId);
            if (matches.length > 0) {
                const proceed = confirm(
                    "⚠ This Transaction ID already exists in the ledger. Save it anyway as a duplicate?"
                );
                if (!proceed) return false;
            }
        }

        const newId = await LedgerDB.addEntry(record);
        record.id = newId;

        App.activeDataset.unshift(record);

        // Reset any active Account/City/Search filter so the record
        // you just saved is guaranteed to show up on screen right away
        // (it was previously getting saved fine but hidden by a filter
        // that didn't match the new entry's Account/City).
        if (typeof SearchFilter !== "undefined" && SearchFilter.clearFilters) {
            SearchFilter.clearFilters();
        } else {
            App.applyFiltersAndRender();
        }

        return true;
    }

    /**
     * Inline table edit — called by table.js whenever a cell
     * loses focus (or the "Checked" checkbox is toggled).
     * Updates the in-memory record + IndexedDB, no full re-render
     * needed since the DOM cell already shows the new value.
     */
    async function updateField(id, field, value) {
        const record = App.activeDataset.find(r => r.id === id);
        if (!record) return;

        record[field] = value;

        try {
            await LedgerDB.updateEntry(record);
        } catch (err) {
            console.error("Failed to save inline edit:", err);
        }

        // Amount edits affect the metrics cards — refresh those only
        if (field === "amount" || field === "date") {
            Dashboard.update(SearchFilter.getFiltered());
        }
    }

    /**
     * Delete a row — called by table.js when the X button on a
     * row is clicked. Removes from IndexedDB + in-memory dataset,
     * then re-runs the active filter so the table/dashboard refresh.
     */
    async function deleteRecord(id) {
        try {
            await LedgerDB.deleteEntry(id);
        } catch (err) {
            console.error("Failed to delete record:", err);
            return;
        }

        App.activeDataset = App.activeDataset.filter(r => r.id !== id);
        SearchFilter.execute();
    }

    /**
     * Bulk save — used by the "📋 Paste WhatsApp Log" flow.
     * Takes the parser's row shape { id, amount, phone, date, message, status }
     * and maps it onto the standard ledger record before saving each one.
     */
    async function commitBulkEntries(parsedRows) {
        const stamp = todayStamp();
        const newRecords = [];

        for (const p of parsedRows) {
            const record = {
                date: p.date || stamp.date,
                time: "",
                recipientName: p.message || "",
                amount: p.amount === "" || isNaN(p.amount) ? 0 : Number(p.amount),
                transactionId: "",
                userId: p.id || "",
                accountName: "",
                city: p.city || "",
                checked: false,
                billNotes: p.status || "",
                senderNumber: p.phone || "",
                createdTime: new Date().toISOString()
            };

            const newId = await LedgerDB.addEntry(record);
            record.id = newId;
            newRecords.push(record);
        }

        App.activeDataset = newRecords.concat(App.activeDataset);
        App.applyFiltersAndRender();
    }

    /**
     * Excel Import save — used by the "📥 Import Excel" flow.
     * Takes rows already normalized to the standard ledger record shape
     * (from excel-import.js) and writes each one into the SAME IndexedDB
     * store used by Manual Entry / WhatsApp Bulk, so they show up in the
     * main table, dashboard, filters and Excel export automatically.
     */
    async function commitExcelEntries(rows) {
        const stamp = todayStamp();
        const newRecords = [];

        for (const r of rows) {
            const record = {
                date: r.date || stamp.date,
                time: r.time || "",
                recipientName: r.recipientName || "",
                amount: isNaN(r.amount) ? 0 : Number(r.amount),
                transactionId: r.transactionId || "",
                userId: r.userId || "",
                accountName: r.accountName || "",
                city: r.city || "",
                checked: !!r.checked,
                billNotes: r.billNotes || "",
                senderNumber: r.senderNumber || "",
                createdTime: new Date().toISOString()
            };

            const newId = await LedgerDB.addEntry(record);
            record.id = newId;
            newRecords.push(record);
        }

        App.activeDataset = newRecords.concat(App.activeDataset);
        App.applyFiltersAndRender();

        return newRecords.length;
    }

    return { commitManualEntry, commitBulkEntries, commitExcelEntries, updateField, deleteRecord };
})();
