import { describe, expect, it } from 'vitest';
import { isUsbCamera, newlyConnected } from '../../src/features/face/camera';

describe('Face ID camera list', () => {
  it('lists external cameras, including names without "USB"', () => {
    expect(isUsbCamera('HD Pro Webcam C920 (046d:082d)')).toBe(true);
    expect(isUsbCamera('SHUNCCM (1b17:0211)')).toBe(true);
    expect(isUsbCamera('HD Camera')).toBe(true);
  });
  it('hides built-in and virtual cameras', () => {
    expect(isUsbCamera('Integrated Camera (04f2:b6dd)')).toBe(false);
    expect(isUsbCamera('FaceTime HD Camera')).toBe(false);
    expect(isUsbCamera('OBS Virtual Camera')).toBe(false);
    expect(isUsbCamera('')).toBe(false);
  });
  it('picks the camera that was just plugged in', () => {
    expect(newlyConnected(['a'], [{ deviceId: 'a' }, { deviceId: 'b' }])).toBe('b');
    expect(newlyConnected(['a'], [{ deviceId: 'a' }])).toBe(null);
  });
});
