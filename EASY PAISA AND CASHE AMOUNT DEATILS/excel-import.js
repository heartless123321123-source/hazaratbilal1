/**
 * excel-import.js
 * -----------------------------------------------------------
 * UI controller for the "📥 Import Excel" button.
 * Flow: user picks an .xlsx/.xls/.csv file → we read it with
 * SheetJS → map each row's columns (flexible header names)
 * onto the standard ledger record shape → confirm with the
 * user → EntryManager.commitExcelEntries() writes every row
 * into the SAME IndexedDB store used by Manual Entry / Scan /
 * WhatsApp Bulk, so it appears in the main table, dashboard,
 * filters and Excel export automatically.
 * -----------------------------------------------------------
 */

const ExcelImport = (function () {

    // Accepted header names -> standard ledger field.
    // Matching is case-insensitive and ignores spaces/underscores.
    const HEADER_MAP = {
        date: "date",
        stampentrydate: "date",
        time: "time",
        name: "name",
        clientname: "name",
        clientdescriptionname: "name",
        description: "name",
        account: "account",
        allocatedaccountbook: "account",
        city: "city",
        cityregioncode: "city",
        zone: "city",
        amount: "amount",
        netledgeramount: "amount",
        netamount: "amount",
        transactionid: "transactionId",
        txnid: "transactionId",
        customerid: "customerId",
        status: "status",
        sender: "sender"
    };

    function normalizeHeader(h) {
        return String(h || "").toLowerCase().replace(/[\s_\-\/]/g, "");
    }

    function el(id) { return document.getElementById(id); }

    function triggerPicker() {
        el("excelImportInput").click();
    }

    function handleFileChosen(file) {
        if (!file) return;

        if (typeof XLSX === "undefined") {
            alert("Excel engine (SheetJS) not loaded — check your internet connection.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: "array" });
                const firstSheetName = wb.SheetNames[0];
                const ws = wb.Sheets[firstSheetName];
                const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

                processRows(rows);
            } catch (err) {
                console.error("Excel import failed:", err);
                alert("File parh nahi saka — please make sure it's a valid Excel/CSV file.");
            } finally {
                el("excelImportInput").value = "";
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function mapRow(rawRow) {
        const record = { date: "", time: "", name: "", account: "", city: "", amount: 0, transactionId: "", customerId: "", status: "", sender: "" };

        Object.keys(rawRow).forEach((key) => {
            const normKey = normalizeHeader(key);
            const field = HEADER_MAP[normKey];
            if (field) {
                record[field] = rawRow[key];
            }
        });

        // Excel dates sometimes come through as serial numbers — convert if needed
        if (record.date && typeof record.date === "number") {
            const parsed = XLSX.SSF ? XLSX.SSF.parse_date_code(record.date) : null;
            if (parsed) {
                record.date = String(parsed.d).padStart(2, "0") + "-" + String(parsed.m).padStart(2, "0") + "-" + parsed.y;
            }
        }

        record.amount = parseFloat(record.amount) || 0;
        return record;
    }

    async function processRows(rawRows) {
        if (!rawRows || rawRows.length === 0) {
            alert("Excel file mein koi data nahi mila.");
            return;
        }

        const mapped = rawRows
            .map(mapRow)
            .filter(r => r.name || r.amount > 0 || r.account); // skip totally blank rows

        if (mapped.length === 0) {
            alert("Koi valid row nahi mili — sheet ke column headers check karein (Name, Account, City, Amount, etc).");
            return;
        }

        const proceed = confirm(`${mapped.length} records is Excel file mein mile. Ledger mein import kar dein?`);
        if (!proceed) return;

        const count = await EntryManager.commitExcelEntries(mapped);
        alert(`${count} records ledger mein import ho gaye — Master Spreadsheet update ho chuki hai.`);
    }

    return { triggerPicker, handleFileChosen };
})();
