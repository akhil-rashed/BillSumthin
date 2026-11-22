import { getPlugin, isCapacitorNative } from './utils.js';
import { t } from './language.js';

export async function ensureCameraPermission() {
  if (isCapacitorNative()) {
    const cam = getPlugin('NativeCamera');
    if (cam?.checkPermissions && cam?.requestPermissions) {
      const status = await cam.checkPermissions();
      if (status?.camera === 'granted') return { granted: true };
      const req = await cam.requestPermissions();
      if (req?.camera === 'granted') return { granted: true };
      return {
        granted: false,
        title: t('perm.cameraTitle', 'Camera access needed'),
        message: t('perm.cameraDesc', 'BillSumthin needs camera access to scan bills.'),
        canOpenSettings: true
      };
    }
  }
  return { granted: true };
}

export async function openAppPermissionSettings() {
  const cam = getPlugin('NativeCamera');
  if (cam?.openAppSettings) {
    try {
      await cam.openAppSettings();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
