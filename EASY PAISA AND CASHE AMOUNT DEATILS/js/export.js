/**
 * export.js
 * -----------------------------------------------------------
 * Exports the currently visible (filtered) dataset to a
 * polished, presentation-quality .xlsx report using ExcelJS:
 *
 *   - Branded title banner (company name + subtitle + date)
 *   - Colorful gradient-style header row (emerald -> teal -> blue)
 *   - Zebra-striped, bordered data rows
 *   - Color-coded status "badges" (paid/pending/failed etc.)
 *   - Currency-formatted, bold Amount column
 *   - Auto-sized columns, frozen header, auto-filter
 *   - Totals summary row at the bottom
 *   - Landscape print setup, fit-to-width
 *
 * Defensive: every field is safely coerced before use, so bad
 * legacy data (e.g. a numeric transactionId) can never crash it.
 * -----------------------------------------------------------
 */

const ExportEngine = (function () {

    function safeStr(v) {
        if (v === null || v === undefined) return "";
        return String(v).trim();
    }

    function safeNum(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    // Maps a status string to a badge color (fill + text)
    function statusColors(statusRaw) {
        const s = safeStr(statusRaw).toLowerCase();
        if (/(success|paid|complete|confirmed|approved)/.test(s)) {
            return { fill: "FFD1FAE5", font: "FF047857" };   // green
        }
        if (/(pending|processing|review)/.test(s)) {
            return { fill: "FFFEF3C7", font: "FFB45309" };   // amber
        }
        if (/(fail|reject|revers|cancel|dispute)/.test(s)) {
            return { fill: "FFFEE2E2", font: "FFB91C1C" };   // red
        }
        return { fill: "FFF1F5F9", font: "FF475569" };       // neutral slate
    }

    const COLS = [
        { header: "#", key: "num", width: 6 },
        { header: "Date", key: "date", width: 13 },
        { header: "Time", key: "time", width: 11 },
        { header: "Client / Description", key: "name", width: 26 },
        { header: "Account", key: "account", width: 16 },
        { header: "City / Zone", key: "city", width: 16 },
        { header: "Sender", key: "sender", width: 16 },
        { header: "Transaction ID", key: "txnId", width: 20 },
        { header: "Customer ID", key: "custId", width: 16 },
        { header: "Status", key: "status", width: 14 },
        { header: "Amount (Rs.)", key: "amount", width: 16 }
    ];
    const LAST_COL = COLS.length;
    const AMOUNT_COL = LAST_COL;
    const STATUS_COL = LAST_COL - 1;

    // Header gradient bands: rich gold -> amber -> deep amber (unique yellow theme)
    const HEADER_BAND_COLORS = ["FFF5B301", "FFFACC15", "FFEAB308"];
    function headerColorFor(colIndex) {
        const third = Math.ceil(LAST_COL / 3);
        if (colIndex <= third) return HEADER_BAND_COLORS[0];
        if (colIndex <= third * 2) return HEADER_BAND_COLORS[1];
        return HEADER_BAND_COLORS[2];
    }

    function colLetter(n) {
        let s = "";
        while (n > 0) {
            const m = (n - 1) % 26;
            s = String.fromCharCode(65 + m) + s;
            n = Math.floor((n - m) / 26);
        }
        return s;
    }

    async function exportToExcel() {
        if (typeof ExcelJS === "undefined") {
            alert("Excel engine (ExcelJS) not loaded — check your internet connection.");
            return;
        }

        let dataset;
        try {
            dataset = SearchFilter.getFiltered();
        } catch (err) {
            console.error("SearchFilter.getFiltered() failed, falling back to full ledger:", err);
            dataset = await LedgerDB.getAllEntries();
        }

        if (!dataset || dataset.length === 0) {
            alert("No records to export in the current view.");
            return;
        }

        try {
            const rows = dataset.map((r, i) => ({
                num: i + 1,
                date: safeStr(r.date),
                time: safeStr(r.time),
                name: safeStr(r.name),
                account: safeStr(r.account),
                city: safeStr(r.city),
                sender: safeStr(r.sender),
                txnId: safeStr(r.transactionId),
                custId: safeStr(r.customerId),
                status: safeStr(r.status) || "—",
                amount: safeNum(r.amount)
            }));

            const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);

            const workbook = new ExcelJS.Workbook();
            workbook.creator = "AirTouch Wireless ISP Network";
            workbook.created = new Date();

            const sheet = workbook.addWorksheet("Ledger", {
                pageSetup: {
                    orientation: "landscape",
                    fitToPage: true,
                    fitToWidth: 1,
                    fitToHeight: 0,
                    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }
                }
            });

            const lastColLetter = colLetter(LAST_COL);

            // ---------- TITLE BANNER ----------
            sheet.mergeCells(`A1:${lastColLetter}1`);
            const titleCell = sheet.getCell("A1");
            titleCell.value = "AirTouch  Wireless ISP Network — Transaction Ledger";
            titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFBEB" } };
            titleCell.alignment = { vertical: "middle", horizontal: "center" };
            titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB45309" } };
            sheet.getRow(1).height = 30;

            sheet.mergeCells(`A2:${lastColLetter}2`);
            const subtitleCell = sheet.getCell("A2");
            subtitleCell.value = "Wireless ISP Network (Pvt) Ltd. — Management System  |  Enterprise Ledger Hub";
            subtitleCell.font = { italic: true, size: 10.5, color: { argb: "FFFFFBEB" } };
            subtitleCell.alignment = { vertical: "middle", horizontal: "center" };
            subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD97706" } };
            sheet.getRow(2).height = 20;

            sheet.mergeCells(`A3:${lastColLetter}3`);
            const metaCell = sheet.getCell("A3");
            const now = new Date();
            metaCell.value =
                `Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}   •   Records: ${rows.length}   •   Total: Rs. ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            metaCell.font = { size: 9.5, bold: true, color: { argb: "FF422006" } };
            metaCell.alignment = { vertical: "middle", horizontal: "center" };
            metaCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCD34D" } };
            sheet.getRow(3).height = 18;

            // blank spacer row
            sheet.getRow(4).height = 6;

            // ---------- HEADER ROW ----------
            const headerRowIndex = 5;
            const headerRow = sheet.getRow(headerRowIndex);
            COLS.forEach((col, idx) => {
                const cell = headerRow.getCell(idx + 1);
                cell.value = col.header;
                sheet.getColumn(idx + 1).width = col.width;
                cell.font = { bold: true, size: 11, color: { argb: "FF422006" } };
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerColorFor(idx + 1) } };
                cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
                cell.border = {
                    top: { style: "thin", color: { argb: "FFFFFFFF" } },
                    left: { style: "thin", color: { argb: "FFFFFFFF" } },
                    bottom: { style: "medium", color: { argb: "FF78350F" } },
                    right: { style: "thin", color: { argb: "FFFFFFFF" } }
                };
            });
            headerRow.height = 26;

            // ---------- DATA ROWS ----------
            const firstDataRow = headerRowIndex + 1;
            rows.forEach((r, i) => {
                const excelRow = sheet.getRow(firstDataRow + i);
                excelRow.getCell(1).value = r.num;
                excelRow.getCell(2).value = r.date;
                excelRow.getCell(3).value = r.time;
                excelRow.getCell(4).value = r.name;
                excelRow.getCell(5).value = r.account;
                excelRow.getCell(6).value = r.city;
                excelRow.getCell(7).value = r.sender;
                excelRow.getCell(8).value = r.txnId;
                excelRow.getCell(9).value = r.custId;
                excelRow.getCell(10).value = r.status;
                excelRow.getCell(11).value = r.amount;

                const isEven = i % 2 === 0;
                const badge = statusColors(r.status);

                for (let c = 1; c <= LAST_COL; c++) {
                    const cell = excelRow.getCell(c);
                    cell.border = {
                        top: { style: "thin", color: { argb: "FFE2E8F0" } },
                        left: { style: "thin", color: { argb: "FFE2E8F0" } },
                        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
                        right: { style: "thin", color: { argb: "FFE2E8F0" } }
                    };
                    cell.font = { size: 10.5, color: { argb: "FF1E293B" } };
                    cell.alignment = { vertical: "middle", horizontal: c === 1 ? "center" : "left" };

                    if (isEven) {
                        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } };
                    }

                    if (c === STATUS_COL) {
                        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: badge.fill } };
                        cell.font = { size: 10, bold: true, color: { argb: badge.font } };
                        cell.alignment = { vertical: "middle", horizontal: "center" };
                    }

                    if (c === AMOUNT_COL) {
                        cell.numFmt = '"Rs. "#,##0.00';
                        cell.alignment = { vertical: "middle", horizontal: "right" };
                        cell.font = { size: 10.5, bold: true, color: { argb: "FFB45309" } };
                    }
                }
            });

            // ---------- TOTALS ROW ----------
            const totalsRowIndex = firstDataRow + rows.length;
            const totalsRow = sheet.getRow(totalsRowIndex);
            sheet.mergeCells(totalsRowIndex, 1, totalsRowIndex, AMOUNT_COL - 1);
            const totalsLabel = totalsRow.getCell(1);
            totalsLabel.value = `TOTAL  (${rows.length} record${rows.length === 1 ? "" : "s"})`;
            totalsLabel.font = { bold: true, size: 11, color: { argb: "FFFFFBEB" } };
            totalsLabel.alignment = { vertical: "middle", horizontal: "right" };
            totalsLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF78350F" } };

            const totalsValue = totalsRow.getCell(AMOUNT_COL);
            totalsValue.value = totalAmount;
            totalsValue.numFmt = '"Rs. "#,##0.00';
            totalsValue.font = { bold: true, size: 12, color: { argb: "FFFFFBEB" } };
            totalsValue.alignment = { vertical: "middle", horizontal: "right" };
            totalsValue.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF78350F" } };
            totalsRow.height = 24;
            for (let c = 1; c <= LAST_COL; c++) {
                totalsRow.getCell(c).border = {
                    top: { style: "medium", color: { argb: "FF78350F" } },
                    bottom: { style: "double", color: { argb: "FF78350F" } }
                };
            }

            // ---------- Freeze panes + auto-filter ----------
            sheet.views = [{ state: "frozen", ySplit: headerRowIndex }];
            sheet.autoFilter = {
                from: { row: headerRowIndex, column: 1 },
                to: { row: headerRowIndex, column: LAST_COL }
            };

            // ---------- Download ----------
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            });
            const stamp = new Date().toISOString().slice(0, 10);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `AirTouch_Ledger_${stamp}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

        } catch (err) {
            console.error("Export failed:", err);
            alert("Export fail ho gaya. Wajah: " + err.message);
        }
    }

    return { exportToExcel };
})();
