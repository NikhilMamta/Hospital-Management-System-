/**
 * Utilities for pharmacy slip generation and stamping.
 */

/**
 * Draws the 3-box footer (Prepared By, Approved By, Given By) on a canvas context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} y - Top Y coordinate of the footer (default 1050)
 * @param {object} options
 * @param {string} [options.preparedBy] - Name of preparer
 * @param {string} [options.approvedBy] - Name of approver
 * @param {string} [options.givenBy] - Name of dispenser (store person)
 */
export const renderSlipCanvasFooter = (
  ctx,
  y = 1050,
  { preparedBy = "Nikhil Kumar Uranw", approvedBy = "Pharmacy", givenBy = "" } = {},
) => {
  // Clear footer area with slip yellow background
  ctx.fillStyle = "#FFEB3B";
  ctx.fillRect(10, y, 830, 41);

  // 3 footer boxes and outer border
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.strokeRect(10, y, 276, 40);
  ctx.strokeRect(286, y, 277, 40);
  ctx.strokeRect(563, y, 277, 40);
  ctx.strokeRect(10, 10, 830, 1080);

  // Text styling
  ctx.fillStyle = "#000000";
  ctx.textAlign = "left";

  // Box 1: Prepared By
  ctx.font = "bold 12px Arial";
  ctx.fillText("Prepared By", 20, y + 15);
  ctx.font = "11px Arial";
  ctx.fillText(preparedBy || "Nikhil Kumar Uranw", 20, y + 32, 255);

  // Box 2: Approved By
  ctx.font = "bold 12px Arial";
  ctx.fillText("Approved By", 296, y + 15);
  ctx.font = "11px Arial";
  ctx.fillText(approvedBy || "Pharmacy", 296, y + 32, 255);

  // Box 3: Given By
  ctx.font = "bold 12px Arial";
  ctx.fillText("Given By", 573, y + 15);
  ctx.font = "11px Arial";
  ctx.fillText(givenBy || "", 573, y + 32, 255);
};

/**
 * Loads an existing slip image and updates its footer with Prepared By, Approved By, and Given By.
 *
 * @param {string} slipImageUrl - URL or base64 of the existing slip image
 * @param {object} options
 * @param {string} [options.preparedBy]
 * @param {string} [options.approvedBy]
 * @param {string} [options.givenBy]
 * @returns {Promise<string>} Base64 PNG data URL
 */
export const stampSlipFooter = async (
  slipImageUrl,
  { preparedBy = "Nikhil Kumar Uranw", approvedBy = "Pharmacy", givenBy = "" } = {},
) => {
  if (!slipImageUrl) return null;

  return new Promise((resolve, reject) => {
    const applyToCanvas = (imageElement) => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 850;
        canvas.height = 1100;
        const ctx = canvas.getContext("2d");

        // Draw original slip image
        ctx.drawImage(imageElement, 0, 0, 850, 1100);

        // Render updated 3-box footer
        renderSlipCanvasFooter(ctx, 1050, {
          preparedBy,
          approvedBy,
          givenBy,
        });

        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        console.error("Error drawing stamped slip canvas:", err);
        reject(err);
      }
    };

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => applyToCanvas(img);

    img.onerror = () => {
      // Fallback: fetch as blob to avoid crossOrigin cache taint
      fetch(slipImageUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          const fallbackImg = new Image();
          fallbackImg.onload = () => {
            applyToCanvas(fallbackImg);
            URL.revokeObjectURL(blobUrl);
          };
          fallbackImg.onerror = (e) => {
            URL.revokeObjectURL(blobUrl);
            reject(e);
          };
          fallbackImg.src = blobUrl;
        })
        .catch(reject);
    };

    if (slipImageUrl.startsWith("data:")) {
      img.src = slipImageUrl;
    } else {
      const sep = slipImageUrl.includes("?") ? "&" : "?";
      img.src = `${slipImageUrl}${sep}t=${Date.now()}`;
    }
  });
};
