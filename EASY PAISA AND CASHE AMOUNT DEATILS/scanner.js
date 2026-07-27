/**
 * scanner.js
 * -----------------------------------------------------------
 * Drives the "📷 Scan Screenshot" flow:
 *   Choose Screenshot → Scanning... → OCR Complete →
 *   Parse (Amount/Date/Time/Txn ID/Sender) → Auto-fill form →
 *   User checks/edits → Save (handled by entry.js)
 * -----------------------------------------------------------
 */

const Scanner = (function () {

    let currentImageDataUrl = null;
    let currentFileName = null;

    function el(id) { return document.getElementById(id); }

    function openModal() {
        el("scanModal").classList.remove("hidden");
        resetModal();
    }

    function closeModal() {
        el("scanModal").classList.add("hidden");
    }

    function resetModal() {
        currentImageDataUrl = null;
        currentFileName = null;
        el("scanFileInput").value = "";
        el("scanPreviewWrap").classList.add("hidden");
        el("scanProgressWrap").classList.add("hidden");
        el("scanResultForm").classList.add("hidden");
        el("scanDuplicateWarning").classList.add("hidden");
        el("scanProgressBar").style.width = "0%";
        el("scanProgressLabel").innerText = "Waiting for image...";
    }

    function handleFileChosen(file) {
        if (!file) return;
        currentFileName = file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            currentImageDataUrl = e.target.result;
            el("scanPreviewImg").src = currentImageDataUrl;
            el("scanPreviewWrap").classList.remove("hidden");
            runScan(file);
        };
        reader.readAsDataURL(file);
    }

    async function runScan(file) {
        el("scanProgressWrap").classList.remove("hidden");
        el("scanResultForm").classList.add("hidden");
        el("scanProgressBar").style.width = "5%";
        el("scanProgressLabel").innerText = "Scanning...";

        try {
            const rawText = await OCREngine.recognize(file, (pct, status) => {
                el("scanProgressBar").style.width = pct + "%";
                el("scanProgressLabel").innerText = `${status} (${pct}%)`;
            });

            const parsed = parseReceiptText(rawText);
            fillResultForm(parsed);

            el("scanProgressLabel").innerText = "OCR Complete";
            el("scanResultForm").classList.remove("hidden");

            // Duplicate check against IndexedDB
            if (parsed.transactionId) {
                const matches = await LedgerDB.findByTransactionId(parsed.transactionId);
                if (matches.length > 0) {
                    el("scanDuplicateWarning").classList.remove("hidden");
                } else {
                    el("scanDuplicateWarning").classList.add("hidden");
                }
            }
        } catch (err) {
            console.error(err);
            el("scanProgressLabel").innerText = "OCR failed: " + err.message;
        }
    }

    /**
     * Heuristic text parser — pulls Amount, Date, Time,
     * Transaction ID, Sender/Customer name out of raw OCR text.
     * Screenshots vary (Easypaisa/JazzCash/bank apps) so we try
     * several patterns and fall back gracefully.
     */
    function parseReceiptText(text) {
        const clean = text.replace(/\r/g, "");

        // Amount: "Rs 1,500", "PKR 1500.00", "Amount: 1500"
        const amountMatch = clean.match(/(?:Rs\.?|PKR)\s*([\d,]+(?:\.\d{1,2})?)/i)
            || clean.match(/Amount[^\d]{0,10}([\d,]+(?:\.\d{1,2})?)/i);
        const amount = amountMatch ? amountMatch[1].replace(/,/g, "") : "";

        // Date: dd-mm-yyyy, dd/mm/yyyy, or "18 Jul 2026"
        const dateMatch = clean.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/)
            || clean.match(/(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/);
        const date = dateMatch ? dateMatch[1] : "";

        // Time: "02:15 PM", "14:15"
        const timeMatch = clean.match(/(\d{1,2}:\d{2}(?:\s?[APap][Mm])?)/);
        const time = timeMatch ? timeMatch[1] : "";

        // Transaction / Trx ID
        const txnMatch = clean.match(/(?:Transaction|Trx|Txn|TID)\s*(?:ID|No\.?|#)?[:\s]*([A-Za-z0-9]{5,})/i);
        const transactionId = txnMatch ? txnMatch[1] : "";

        // Sender / From / Customer name
        const senderMatch = clean.match(/(?:From|Sender)[:\s]*([A-Za-z][A-Za-z\s]{2,30})/i);
        const sender = senderMatch ? senderMatch[1].trim() : "";

        const customerMatch = clean.match(/(?:Customer\s*ID|CNIC|Account\s*No\.?)[:\s]*([A-Za-z0-9\-]{4,})/i);
        const customerId = customerMatch ? customerMatch[1].trim() : "";

        return { amount, date, time, transactionId, sender, customerId, rawText: clean };
    }

    function fillResultForm(parsed) {
        el("scanAmount").value = parsed.amount || "";
        el("scanDate").value = parsed.date || "";
        el("scanTime").value = parsed.time || "";
        el("scanTxnId").value = parsed.transactionId || "";
        el("scanSender").value = parsed.sender || "";
        el("scanCustomerId").value = parsed.customerId || "";
    }

    function getCurrentImageName() {
        return currentFileName;
    }

    return { openModal, closeModal, handleFileChosen, getCurrentImageName };
})();
