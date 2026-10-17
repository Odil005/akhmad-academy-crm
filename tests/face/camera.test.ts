import { describe, expect, it } from 'vitest';
import { isUsbCamera } from '../../src/features/face/camera';

describe('USB-only Face ID camera', () => {
  it('accepts USB cameras', () => {
    expect(isUsbCamera('HD Pro Webcam C920 (046d:082d)')).toBe(true);
    expect(isUsbCamera('USB2.0 PC CAMERA (1908:2310)')).toBe(true);
  });
  it('rejects built-in cameras', () => {
    expect(isUsbCamera('Integrated Camera (04f2:b6dd)')).toBe(false);
    expect(isUsbCamera('FaceTime HD Camera')).toBe(false);
    expect(isUsbCamera('camera2 1, facing front')).toBe(false);
    expect(isUsbCamera('')).toBe(false);
  });
});
