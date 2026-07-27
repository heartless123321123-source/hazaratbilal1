/**
 * ocr.js
 * -----------------------------------------------------------
 * Thin wrapper around Tesseract.js. Takes an image file
 * (screenshot) and returns raw recognized text. Parsing that
 * text into structured fields (amount/date/txn id) happens
 * in scanner.js — this file only does the OCR step.
 * -----------------------------------------------------------
 */

const OCREngine = (function () {

    /**
     * Runs OCR on an image file/blob.
     * @param {File|Blob} imageFile
     * @param {(progress:number, status:string)=>void} onProgress 0-100
     * @returns {Promise<string>} raw recognized text
     */
    async function recognize(imageFile, onProgress) {
        if (typeof Tesseract === "undefined") {
            throw new Error("Tesseract.js library not loaded. Check your internet connection / script tag.");
        }

        const result = await Tesseract.recognize(imageFile, "eng", {
            logger: (m) => {
                if (onProgress && m.status) {
                    const pct = m.progress ? Math.round(m.progress * 100) : 0;
                    onProgress(pct, m.status);
                }
            }
        });

        return result.data.text || "";
    }

    return { recognize };
})();
