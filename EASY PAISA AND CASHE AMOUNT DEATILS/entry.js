/**
 * entry.js
 * -----------------------------------------------------------
 * Builds a ledger record (manual OR from the scan modal),
 * runs duplicate check, saves it to IndexedDB (database.js),
 * then asks app.js to refresh the in-memory dataset + UI.
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
        const city = el("formCity").value;
        const amountVal = parseFloat(el("formAmount").value);

        if (!name || isNaN(amountVal) || amountVal <= 0) {
            alert("Kindly input a valid Client Name and Amount greater than zero.");
            return;
        }

        const stamp = todayStamp();

        const record = {
            date: stamp.date,
            time: stamp.time,
            name: name,
            account: account,
            city: city,
            amount: amountVal,
            sender: name,
            transactionId: "",
            customerId: "",
            status: "Confirmed",
            screenshotPath: "",
            createdTime: new Date().toISOString()
        };

        await saveRecord(record);

        el("formName").value = "";
        el("formAmount").value = "";
    }

    /** Scanned entry — triggered by "Confirm & Save" inside scan modal */
    async function commitScannedEntry() {
        const amountVal = parseFloat(el("scanAmount").value);
        const name = el("scanSender").value.trim() || "Unnamed Client";

        if (isNaN(amountVal) || amountVal <= 0) {
            alert("OCR could not confidently read the Amount. Please correct it before saving.");
            return;
        }

        const stamp = todayStamp();

        const record = {
            date: el("scanDate").value.trim() || stamp.date,
            time: el("scanTime").value.trim() || stamp.time,
            name: name,
            account: el("scanAccount").value,
            city: el("scanCity").value,
            amount: amountVal,
            sender: name,
            transactionId: el("scanTxnId").value.trim(),
            customerId: el("scanCustomerId").value.trim(),
            status: "Confirmed",
            screenshotPath: Scanner.getCurrentImageName() || "",
            createdTime: new Date().toISOString()
        };

        // Duplicate guard — final check right before saving
        if (record.transactionId) {
            const matches = await LedgerDB.findByTransactionId(record.transactionId);
            if (matches.length > 0) {
                const proceed = confirm(
                    "⚠ This Transaction ID already exists in the ledger. Save it anyway as a duplicate?"
                );
                if (!proceed) return;
                record.status = "Duplicate";
            }
        }

        await saveRecord(record);
        Scanner.closeModal();
    }

    async function saveRecord(record) {
        const newId = await LedgerDB.addEntry(record);
        record.id = newId;

        // Update in-memory dataset + refresh Table/Dashboard/Storage
        App.activeDataset.unshift(record);
        App.applyFiltersAndRender();
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
            const office = (p.id || "").match(/^([a-z]+)/i);
            const officeCode = office ? office[1].toUpperCase() : "";

            const record = {
                date: p.date || stamp.date,
                time: "",
                name: p.message || "",
                account: "",
                city: officeCode,
                amount: p.amount === "" || isNaN(p.amount) ? 0 : Number(p.amount),
                sender: p.phone || "",
                transactionId: "",
                customerId: p.id || "",
                status: p.status || "Pending",
                screenshotPath: "",
                createdTime: new Date().toISOString()
            };

            const newId = await LedgerDB.addEntry(record);
            record.id = newId;
            newRecords.push(record);
        }

        // Prepend all new records at once, then refresh UI a single time
        App.activeDataset = newRecords.concat(App.activeDataset);
        App.applyFiltersAndRender();
    }

    /**
     * Excel Import save — used by the "📥 Import Excel" flow.
     * Takes rows already normalized to the standard ledger record shape
     * (from excel-import.js) and writes each one into the SAME IndexedDB
     * store used by Manual Entry / Scan / WhatsApp Bulk, so they show up
     * in the main table, dashboard, filters and Excel export automatically.
     */
    async function commitExcelEntries(rows) {
        const stamp = todayStamp();
        const newRecords = [];

        for (const r of rows) {
            const record = {
                date: r.date || stamp.date,
                time: r.time || "",
                name: r.name || "",
                account: r.account || "",
                city: r.city || "",
                amount: isNaN(r.amount) ? 0 : Number(r.amount),
                sender: r.sender || r.name || "",
                transactionId: r.transactionId || "",
                customerId: r.customerId || "",
                status: r.status || "Confirmed",
                screenshotPath: "",
                createdTime: new Date().toISOString()
            };

            const newId = await LedgerDB.addEntry(record);
            record.id = newId;
            newRecords.push(record);
        }

        // Prepend all imported records at once, then refresh UI a single time
        App.activeDataset = newRecords.concat(App.activeDataset);
        App.applyFiltersAndRender();

        return newRecords.length;
    }

    return { commitManualEntry, commitScannedEntry, commitBulkEntries, commitExcelEntries };
})();
