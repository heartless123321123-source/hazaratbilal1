/**
 * ocr.js
 * -----------------------------------------------------------
 * Thin wrapper around Tesseract.js. Runs OCR on an image file
 * and returns the raw recognized text. scanner.js is
 * responsible for parsing that text into structured fields.
 * -----------------------------------------------------------
 */

const OCR = (function () {

    async function recognize(file, onProgress) {
        if (typeof Tesseract === "undefined") {
            throw new Error("Tesseract.js not loaded — check your internet connection.");
        }

        const result = await Tesseract.recognize(file, "eng", {
            logger: (m) => {
                if (onProgress && m.status && typeof m.progress === "number") {
                    onProgress(m.status, m.progress);
                }
            }
        });

        return result && result.data ? result.data.text : "";
    }

    return { recognize };
})();
