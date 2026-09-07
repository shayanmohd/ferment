# Ferment

A lab notebook for the living things in your kitchen. Batch timelines with stage plans, feeding reminders
that stretch or shorten with your kitchen temperature, rise tracking you do by dragging a line across your
own jar photo, culture family trees you can hand over with a card, twelve recipes with a percentage
calculator, and a drawn mold triage guide.

Free and complete. No account, no subscription, no ads, and no internet permission.

- **Play listing:** https://play.google.com/store/apps/details?id=com.mohdshayan.ferment
- **Site:** https://shayanmohd.github.io/ferment/
- **Try it in a browser:** https://shayanmohd.github.io/ferment/play/
- **Privacy policy:** https://shayanmohd.github.io/ferment/privacy-policy.html

Ferment is a notebook for a hobby. It is not a food safety authority, it makes no health or nutrition
claims, and it cannot see inside your jar. Categories with real hazard profiles, such as cured meats and
low acid canning, are deliberately out of scope and signposted to the people who publish tested procedures.

## How it is built

`web/` is the whole app: plain HTML, CSS and JavaScript, no build step and no dependencies.

- `js/content.js` is the authored content: twelve recipes as stage plans with percentages, targets and
  recurring checks, eleven guide topics, six triage plates and the line-drawn vessel glyphs.
- `js/store.js` holds every batch, culture and log line in one `localStorage` record under `ferment.v1`.
  It also owns the pure rules: the temperature adjusted feeding interval (roughly double the pace per ten
  degrees warmer, clamped), the rise ratio arithmetic, the agenda of what is due, and the reminder plan.
- `js/photos.js` keeps journal thumbnails in IndexedDB, because a year of jar photographs does not fit in
  `localStorage`. Photos are downscaled to 900px on the long edge before they are stored.
- `js/charts.js` draws the grid paper charts, the lineage tree, the empty state illustrations, the six
  triage plates, and the jar: the app's signature element, a glass jar lit from inside whose level is a
  reading and whose bubbles rise. It is the same drawing as the launcher icon in `store/icon.svg`.
  Every one of them is SVG generated in code, including the seeded noise in the mold hairs, so nothing
  here is model generated or licensed.
- `js/capture.js` is the camera: a live preview with the previous photograph ghosted over it for a
  consistent angle, plus the draggable height lines. There is no computer vision. You place the lines and
  the app does the arithmetic between them.
- `js/app.js` is the five places: Kitchen, Recipes, Cultures, Guide and the camera, plus one sheet used for
  every form.

`android/` is a thin Kotlin WebView shell that serves `web/` from an app private https origin through
`WebViewAssetLoader`, adds haptics, file export, share and locally scheduled reminders, and declares
`VIBRATE`, `CAMERA` and `POST_NOTIFICATIONS` as its only permissions. The web core is copied into the
app's assets by the `syncWebAssets` Gradle task on every build.

`docs/` is the GitHub Pages site: landing page, privacy policy, and a playable copy of the app.

`store/` holds the hand-written brand sources (`icon.svg` and `feature.html`), the screenshot spec and its
seed data, the rendered Play assets and the listing copy.

## Build

```sh
cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew bundleRelease assembleRelease
```

Signing reads `android/keystore.properties`, which is not in this repository.

## Regenerate the assets

```sh
node _shiptools/render-brand.js ferment          # store/icon.svg and store/feature.html -> icons, feature, preview
python _shiptools/privacy.py store/policy.json --out docs/privacy-policy.html
python3 -m http.server 8821 --directory web
node _shiptools/shots.js store/shots.json
rsync -a --delete web/ docs/play/
cp store/screenshots/*.png docs/shots/
```

`docs/privacy-policy.html` is generated, so edit `store/policy.json` rather than the HTML. The screenshot
seed lives in `store/seed.js` and is inlined into `store/shots.json`.

## Tests

`test/` holds the drive scripts used to hunt bugs before each release. Serve the app and run them:

```sh
python3 -m http.server 8821 --directory web
node _shiptools/drive.js http://127.0.0.1:8821/index.html test/02-happy.js --out test/shots
```

They cover first run, the whole happy path, an upgrade from a 1.0.0 record, the input and double tap
edges, persistence and the export and import round trip, and the safe area insets on every screen. Every
script asserts as it goes and fails the run on any console error. `--reduced-motion` runs the same paths
with animation off.

`review-*.js` is the independent second set, written for the 1.0.1 review rather than alongside the fixes.
`review-00-make100.js` runs against a checkout of the shipped 1.0.0 (`git archive <first commit> web`),
drives it with real clicks and dumps its `localStorage` record and IndexedDB photographs to disk;
`review-02-upgrade.js` then loads this build on top of that dump and proves nothing was lost. The rest
cover the back and lifecycle hooks, safe areas measured rather than eyeballed, a WCAG contrast sweep of
every visible text and control, the input edges, and restoring a backup written by a build that is not
this one.

## What is deliberately not here

No community, no recipe forking between users and no outcome aggregation: those need a server and an
account, and this app has neither. Recipes are the twelve authored ones plus whatever you scale them to.

No computer vision. The blueprint wanted a bubble analyser on jar photographs; a camera is not a
microscope and a trained model would need a dataset nobody here has, so rise tracking is a manual height
mark on the ghost overlay instead, and the app says so on the screen where it matters.

No Bluetooth sensors, no widgets, no Quick Settings tile: those need native components this shell does not
provide. No koji, tempeh or miso programs, which are temperature critical and worth doing properly.
No health claims of any kind, ever.
