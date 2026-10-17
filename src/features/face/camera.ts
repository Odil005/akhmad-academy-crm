/** Face ID kiosk accepts only external USB cameras; built-in/laptop/phone cameras are rejected. */
const BUILT_IN = /(integrated|built[- ]?in|facetime|front|back|rear|internal|\bir\b|infrared|virtual|obs|droidcam|ichki|встроен)/i;
const USB = /(usb|\([0-9a-f]{4}:[0-9a-f]{4}\)|logitech|webcam|c9\d\d|c2\d\d|c5\d\d|a4tech|defender|razer|elgato|brio)/i;

export function isUsbCamera(label: string) {
  const l = label.trim();
  return !!l && !BUILT_IN.test(l) && USB.test(l);
}
