/**
 * Face ID kiosk cameras. Browsers do not expose the connection type and most laptop
 * cameras are internally USB too, so only cameras whose name says built-in/virtual are hidden;
 * the operator picks the external USB camera and the choice is remembered.
 */
const EXCLUDED = /(integrated|built[- ]?in|facetime|facing (front|back)|rear|internal|\bir camera\b|infrared|virtual|obs|droidcam|ichki|встроен)/i;

export function isUsbCamera(label: string) {
  const l = label.trim();
  return !!l && !EXCLUDED.test(l);
}

/** When a camera is plugged in while the page is open, prefer the newly connected one. */
export function newlyConnected(before: string[], after: { deviceId: string }[]) {
  return after.find((d) => !before.includes(d.deviceId))?.deviceId ?? null;
}
