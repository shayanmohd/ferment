/* Shared helpers for the reviewer's own drive scripts (review-*.js).
   Deliberately independent of test/lib.js so a bug in that file cannot hide a bug in the app. */

const fs = require('fs');
const path = require('path');
const os = require('os');

/* Where the 1.0.0 fixture is written and read back. Outside the repository on purpose:
   it is a capture of another build's output, not a source file. */
const OUTDIR = process.env.REVIEW_TMP || path.join(os.tmpdir(), 'ferment-review');
fs.mkdirSync(OUTDIR, { recursive: true });

let fails = [];
function check(log, name, ok, detail) {
  log((ok ? 'ok   ' : 'FAIL ') + name + (detail !== undefined && detail !== null ? '  ' + detail : ''));
  if (!ok) fails.push(name + (detail ? ': ' + detail : ''));
  return ok;
}
function report(log) {
  if (fails.length) { const f = fails.slice(); fails = []; throw new Error(f.length + ' assertion(s) failed:\n  ' + f.join('\n  ')); }
  log('all assertions passed');
}

/** Click a button in the open sheet's footer by its visible label. */
async function sheetBtn(page, label) {
  const ok = await page.evaluate(l => {
    const b = Array.prototype.slice.call(document.querySelectorAll('#sheetFoot button'))
      .find(x => x.textContent.trim() === l);
    if (!b) return false;
    b.click();
    return true;
  }, label);
  if (!ok) throw new Error('no sheet button labelled "' + label + '"');
}

/** Click the first VISIBLE match for a selector. The app keeps hidden screens in the DOM,
    so a plain page.click often lands on an off-screen twin. */
async function vclick(page, sel) {
  const ok = await page.evaluate(s => {
    const b = Array.prototype.slice.call(document.querySelectorAll(s)).find(x => x.getClientRects().length);
    if (!b) return false;
    b.scrollIntoView({ block: 'center' });
    b.click();
    return true;
  }, sel);
  if (!ok) throw new Error('no visible ' + sel);
}

/** Click any button anywhere by its visible label (first match that is on screen). */
async function byText(page, sel, label) {
  const ok = await page.evaluate((s, l) => {
    const b = Array.prototype.slice.call(document.querySelectorAll(s))
      .find(x => x.textContent.trim().indexOf(l) === 0 && x.getClientRects().length);
    if (!b) return false;
    b.click();
    return true;
  }, sel, label);
  if (!ok) throw new Error('no ' + sel + ' starting with "' + label + '"');
}

async function setVal(page, sel, v) {
  await page.evaluate((s, val) => {
    const el = document.querySelector(s);
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, sel, String(v));
}

/** The whole notebook as the store wrote it, plus every photograph in IndexedDB. */
async function dumpAll(page) {
  return page.evaluate(async () => {
    const raw = localStorage.getItem('ferment.v1');
    const ks = await Photos.keys();
    const photos = {};
    for (const k of ks) photos[k] = await Photos.get(k);
    return { raw, photos };
  });
}

/** Put a dump back, before any app script runs, so the new build loads on top of it. */
async function seedDump(page, dump) {
  // Seed once only: this runs on every navigation, and a reload must be allowed to read back
  // what the app itself wrote rather than the fixture again.
  await page.evaluateOnNewDocument(raw => {
    try { if (!localStorage.getItem('ferment.v1')) localStorage.setItem('ferment.v1', raw); } catch (e) {}
  }, dump.raw);
}
async function seedPhotos(page, dump) {
  await page.evaluate(async p => {
    for (const k of Object.keys(p)) await Photos.put(k, p[k]);
  }, dump.photos);
}

const NATIVE = () => {
  window.__native = { saved: [], shared: [], scheduled: [], cancelled: 0, asked: 0 };
  window.Native = {
    isNative: () => true,
    vibrate: () => {}, vibratePattern: () => {}, hasAmplitudeControl: () => true,
    cancelVibration: () => {}, keepAwake: () => {},
    saveFile: (name, mime, b64) => { window.__native.saved.push({ name, mime, b64 }); return 'content://dl/' + name; },
    shareText: (s, t) => { window.__native.shared.push({ s, t }); },
    shareUri: () => {},
    scheduleNotifications: j => { window.__native.scheduled = JSON.parse(j); },
    cancelNotifications: () => { window.__native.cancelled++; window.__native.scheduled = []; },
    notificationsAllowed: () => true,
    requestNotificationPermission: () => { window.__native.asked++; return true; }
  };
};

const save = (name, obj) => fs.writeFileSync(path.join(OUTDIR, name), JSON.stringify(obj));
const read = name => JSON.parse(fs.readFileSync(path.join(OUTDIR, name), 'utf8'));

module.exports = { check, report, sheetBtn, vclick, byText, setVal, dumpAll, seedDump, seedPhotos, NATIVE, save, read, OUTDIR };
