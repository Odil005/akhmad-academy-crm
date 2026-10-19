import { describe, expect, it } from 'vitest';
import { chooseCamera, isUsbCamera, newlyConnected } from '../../src/features/face/camera';

describe('Face ID camera list', () => {
  it('uses a phone or integrated camera when no external camera exists', () => {
    expect(chooseCamera([{ deviceId: 'phone', label: 'Front Camera' }])?.deviceId).toBe('phone');
    expect(chooseCamera([{ deviceId: 'laptop', label: 'Integrated Camera' }])?.deviceId).toBe('laptop');
  });
  it('preserves a saved personal camera and recovers when it disappears', () => {
    const devices = [{ deviceId: 'usb', label: 'SHUNCCM' }, { deviceId: 'phone', label: 'Front Camera' }];
    expect(chooseCamera(devices, 'phone')?.deviceId).toBe('phone');
    expect(chooseCamera(devices, 'missing')?.deviceId).toBe('usb');
    expect(chooseCamera([])).toBeUndefined();
  });
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
