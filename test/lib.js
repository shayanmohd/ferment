/* Shared helpers for the Ferment drive scripts. */

/** A window.Native that records every call, so the export and reminder paths can be asserted on. */
const NATIVE_MOCK = () => {
  window.__native = { saved: [], shared: [], scheduled: [], cancelled: 0, buzz: 0 };
  window.Native = {
    isNative: () => true,
    vibrate: (ms) => { window.__native.buzz += ms; },
    vibratePattern: () => {},
    hasAmplitudeControl: () => true,
    cancelVibration: () => {},
    keepAwake: () => {},
    saveFile: (name, mime, b64) => {
      window.__native.saved.push({ name, mime, bytes: b64.length });
      return 'content://downloads/' + name;
    },
    shareText: (subject, text) => { window.__native.shared.push({ subject, text }); },
    shareUri: () => {},
    scheduleNotifications: (json) => { window.__native.scheduled = JSON.parse(json); },
    cancelNotifications: () => { window.__native.cancelled++; window.__native.scheduled = []; },
    notificationsAllowed: () => true,
    requestNotificationPermission: () => true
  };
};

/** Install the mock and reload so it exists before the app's scripts run. */
async function withNative(page) {
  await page.evaluateOnNewDocument(NATIVE_MOCK);
  await page.reload({ waitUntil: 'networkidle0' });
}

/** Android's insets, injected the way the shell injects them. */
async function withInsets(page, top, bottom) {
  await page.evaluateOnNewDocument((t, b) => {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.setProperty('--sat', t + 'px');
      document.documentElement.style.setProperty('--sab', b + 'px');
    });
  }, top, bottom);
  await page.reload({ waitUntil: 'networkidle0' });
}

const check = (log, name, ok, detail) => {
  log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) { check.failures = (check.failures || 0) + 1; check.list = (check.list || []).concat(name + (detail ? ': ' + detail : '')); }
  return ok;
};
const report = (log) => {
  if (check.failures) throw new Error(check.failures + ' assertion(s) failed:\n  ' + (check.list || []).join('\n  '));
  log('all assertions passed');
};

module.exports = { NATIVE_MOCK, withNative, withInsets, check, report };
