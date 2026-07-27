/**
 * scanner.js
 * -----------------------------------------------------------
 * Controls the "Scan Payment Screenshot" modal: preview the
 * chosen image, run OCR (ocr.js), heuristically parse the
 * recognized text into Amount / Date / Time / Txn ID / Sender,
 * warn on duplicate Transaction IDs, then hand off to
 * entry.js (commitScannedEntry) when the user confirms.
 * -----------------------------------------------------------
 */

const Scanner = (function () {

    let currentImageName = "";

    function el(id) { return document.getElementById(id); }

    function openModal() {
        el("scanModal").classList.remove("hidden");
    }

    function closeModal() {
        el("scanModal").classList.add("hidden");
        resetModal();
    }

    function resetModal() {
        currentImageName = "";
        el("scanPreviewWrap").classList.add("hidden");
        el("scanProgressWrap").classList.add("hidden");
        el("scanDuplicateWarning").classList.add("hidden");
        el("scanResultForm").classList.add("hidden");
        el("scanFileInput").value = "";
        ["scanAmount", "scanDate", "scanTime", "scanTxnId", "scanSender", "scanCustomerId"]
            .forEach(id => { if (el(id)) el(id).value = ""; });
    }

    function getCurrentImageName() {
        return currentImageName;
    }

    async function handleFileChosen(file) {
        if (!file) return;
        currentImageName = file.name || "screenshot.png";

        // Preview
        const previewUrl = URL.createObjectURL(file);
        el("scanPreviewImg").src = previewUrl;
        el("scanPreviewWrap").classList.remove("hidden");
        el("scanDuplicateWarning").classList.add("hidden");
        el("scanResultForm").classList.add("hidden");

        // Progress UI
        el("scanProgressWrap").classList.remove("hidden");
        el("scanProgressLabel").innerText = "Starting OCR engine...";
        el("scanProgressBar").style.width = "5%";

        try {
            const text = await OCR.recognize(file, (status, progress) => {
                el("scanProgressLabel").innerText = humanizeStatus(status);
                el("scanProgressBar").style.width = `${Math.round(progress * 100)}%`;
            });

            await applyParsedText(text);
        } catch (err) {
            console.error("OCR failed:", err);
            alert("Screenshot scan nahi ho saka. Aap fields manually bhar sakte hain.");
            el("scanResultForm").classList.remove("hidden");
        } finally {
            el("scanProgressWrap").classList.add("hidden");
        }
    }

    function humanizeStatus(status) {
        const map = {
            "loading tesseract core": "Loading OCR engine...",
            "initializing tesseract": "Initializing...",
            "loading language traineddata": "Loading language data...",
            "initializing api": "Preparing scan...",
            "recognizing text": "Reading screenshot..."
        };
        return map[status] || status;
    }

    async function applyParsedText(text) {
        const parsed = parseReceiptText(text);

        el("scanAmount").value = parsed.amount || "";
        el("scanDate").value = parsed.date || "";
        el("scanTime").value = parsed.time || "";
        el("scanTxnId").value = parsed.transactionId || "";
        el("scanSender").value = parsed.sender || "";
        el("scanCustomerId").value = parsed.customerId || "";

        el("scanResultForm").classList.remove("hidden");

        if (parsed.transactionId) {
            try {
                const matches = await LedgerDB.findByTransactionId(parsed.transactionId);
                el("scanDuplicateWarning").classList.toggle("hidden", matches.length === 0);
            } catch (err) {
                console.error("Duplicate check failed:", err);
            }
        }
    }

    /**
     * Very lightweight heuristic parser for common Easypaisa /
     * JazzCash / bank-app screenshot text. Best-effort only —
     * the user always reviews/edits before saving.
     */
    function parseReceiptText(text) {
        const result = { amount: "", date: "", time: "", transactionId: "", sender: "", customerId: "" };
        if (!text) return result;

        const clean = text.replace(/\r/g, "");

        // Amount: "Rs. 12,500" / "Rs 12500" / "PKR 12,500.00"
        const amountMatch = clean.match(/(?:Rs\.?|PKR)\s*([\d,]+(?:\.\d{1,2})?)/i);
        if (amountMatch) result.amount = amountMatch[1].replace(/,/g, "");

        // Date: dd-mm-yyyy, dd/mm/yyyy, or "18 Jul 2026" style
        const dateMatch = clean.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
        if (dateMatch) {
            const [, d, m, y] = dateMatch;
            const year = y.length === 2 ? "20" + y : y;
            result.date = `${d.padStart(2, "0")}-${m.padStart(2, "0")}-${year}`;
        }

        // Time: hh:mm AM/PM
        const timeMatch = clean.match(/\b(\d{1,2}:\d{2}\s?(?:AM|PM|am|pm)?)\b/);
        if (timeMatch) result.time = timeMatch[1].toUpperCase();

        // Transaction ID: "Txn ID: XXXX" / "Transaction ID XXXX" / "TID: XXXX"
        const txnMatch = clean.match(/(?:Txn\.?\s*ID|Transaction\s*ID|TID)\s*[:#]?\s*([A-Za-z0-9]+)/i);
        if (txnMatch) result.transactionId = txnMatch[1];

        // Sender name: "From: NAME" / "Sender: NAME"
        const senderMatch = clean.match(/(?:From|Sender|Sent by)\s*[:#]?\s*([A-Za-z ]{3,40})/i);
        if (senderMatch) result.sender = senderMatch[1].trim();

        // Customer / Account ID
        const custMatch = clean.match(/(?:Customer\s*ID|Account\s*(?:No|#))\s*[:#]?\s*([A-Za-z0-9]+)/i);
        if (custMatch) result.customerId = custMatch[1];

        return result;
    }

    return { openModal, closeModal, handleFileChosen, getCurrentImageName };
})();
