import { SCANNER_CHAR_MS, SCANNER_MIN_LEN } from "./config.js";
import { getSettings } from "./store.js";
import { lookupBarcode, lookupSku } from "./db.js";
import { normalizeBarcode } from "./utils.js";

const scanListeners = new Set();
let buffer = "";
let lastKeyAt = 0;
let camera = null;
let cameraTarget = null;

function typingInNormalField(e) {
  const el = e.target;
  if (!el) return false;
  if (el.dataset?.scanner === "true") return false;
  const tag = (el.tagName || "").toLowerCase();
  if (tag === "textarea") return true;
  if (tag === "select") return true;
  if (tag === "input") {
    const type = (el.type || "text").toLowerCase();
    if (["checkbox", "radio", "button", "submit", "file"].includes(type)) return false;
    return true;
  }
  if (el.isContentEditable) return true;
  return false;
}

function emitScan(code) {
  const raw = normalizeBarcode(code);
  if (!raw) return;
  const hit = lookupBarcode(raw) || (lookupSku(raw) ? { variant: lookupSku(raw), barcode: { barcode: raw, qtyInBase: 1, type: "INDIVIDUAL" }, qtyInBase: 1, type: "SKU" } : null);
  scanListeners.forEach((fn) => {
    try { fn({ code: raw, hit }); } catch (err) { console.error(err); }
  });
}

function onKeyDown(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const now = Date.now();
  const gap = now - lastKeyAt;
  const threshold = getSettings().scannerCharMs || SCANNER_CHAR_MS;

  if (e.key === "Enter") {
    if (buffer.length >= SCANNER_MIN_LEN && (gap <= threshold * 3 || e.target?.dataset?.scanner === "true")) {
      const code = buffer;
      buffer = "";
      lastKeyAt = now;
      if (e.target?.dataset?.scanner === "true" || !typingInNormalField(e)) {
        e.preventDefault();
        emitScan(code);
      }
    } else {
      buffer = "";
    }
    return;
  }

  if (e.key.length !== 1) {
    if (e.key === "Escape") buffer = "";
    return;
  }

  if (typingInNormalField(e) && e.target?.dataset?.scanner !== "true") {
    buffer = "";
    return;
  }

  if (gap > threshold * 8) buffer = "";
  buffer += e.key;
  lastKeyAt = now;
}

export function startHardwareScanner() {
  document.addEventListener("keydown", onKeyDown, true);
}

export function stopHardwareScanner() {
  document.removeEventListener("keydown", onKeyDown, true);
}

export function onScan(fn) {
  scanListeners.add(fn);
  return () => scanListeners.delete(fn);
}

export function submitBarcode(code) {
  emitScan(code);
}

export async function startCamera(elementId, { fps = 10 } = {}) {
  await stopCamera();
  if (typeof Html5Qrcode === "undefined") {
    throw new Error("Camera scanner library failed to load.");
  }
  camera = new Html5Qrcode(elementId);
  cameraTarget = elementId;
  const formats = typeof Html5QrcodeSupportedFormats !== "undefined"
    ? [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.QR_CODE,
    ]
    : undefined;
  await camera.start(
    { facingMode: "environment" },
    { fps, qrbox: { width: 280, height: 180 }, formatsToSupport: formats },
    (decoded) => emitScan(decoded),
    () => {}
  );
}

export async function stopCamera() {
  if (!camera) return;
  try {
    await camera.stop();
    await camera.clear();
  } catch (_) { /* already stopped */ }
  camera = null;
  cameraTarget = null;
}

export function isCameraRunning() {
  return !!camera;
}

export function focusScannerInput() {
  const el = document.querySelector("[data-scanner='true']");
  if (el) el.focus();
}

export { lookupBarcode };
