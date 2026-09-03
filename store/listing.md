# Ferment: Play Store listing

**Package:** com.mohdshayan.ferment
**Category:** Food & Drink
**Pricing:** Free. No in-app purchases, no subscription, no ads.

## Title (27 / 30)
Ferment: Sourdough & Kimchi

## Short description (79 / 80)
A lab notebook for ferments. Timelines, feeding reminders, mold guide. Offline.

## Full description (3981 / 4000)
Somewhere in your kitchen, something is alive and you are responsible for it. A starter with a name. A jar of kimchi in its funky adolescence. A kombucha culture that eats sugar like a teenager.

Fermentation is a multi day experiment, and most people run it on a sticky note, a rubber band and a hopeful photograph posted to strangers.

EVERY BATCH ON A TIMELINE
Start a batch and it arrives with a stage plan already in place. Brine, pack, ferment, cold store, each with the window it usually takes, the jobs it needs, and the numbers worth watching while it runs. The Kitchen screen is a ward round: every jar with its day number, its stage, and the next thing you actually have to do.

The question stops being "is it ready" and becomes "day 6 of 10, taste it Thursday".

REMINDERS THAT KNOW SOME BIOLOGY
Burp prompts cluster in the loud first days and then stop on their own. A stage tells you when it reaches its window, and tells you again if it runs past it. Feeding intervals follow your kitchen: a starter fed every 12 hours at 21 degrees wants feeding roughly every 8 in a 26 degree kitchen, so log a temperature and the suggestion moves. The app shows its working, in a sentence, in plain words.

Every reminder is computed on your phone from your own jars. Nothing is fetched.

THE RUBBER BAND, KEPT PROPERLY
Photograph the jar with the last shot ghosted over the viewfinder so the series lines up. Drag one line to where the level is now and Ferment works out the multiple and plots the curve. Peaked at 2.4 times, five hours after the feed.

You place the lines. There is no computer vision in this app and none is claimed. The value is the measurement habit, not magic.

CULTURES HAVE FAMILIES
A culture outlives its batches, so it gets a page: its age in years, its feeding history, its portrait. Split off a jar and it joins the family tree. Hand one to a friend with a culture card and the whole line travels with it, ancestors included. Gift a jar, and the tree remembers.

TWELVE RECIPES, SET LIKE LAB TABLES
Sauerkraut, half sour cucumbers, baechu kimchi, kkakdugi, a starter from scratch, reviving a neglected starter, kombucha first and second ferment, an everyday sourdough loaf, overnight focaccia, fermented hot sauce and a one gallon mead. Baker percentages for the bakes, salt percentages for the vegetables, brine percentages for the pickles. Type the flour weight you have and the whole column moves.

Log temperature, pH, gravity, brine strength and tasting notes. They plot on grid paper against the target band for the stage you are in.

THE SAFETY PART, WRITTEN FLAT
Six triage plates, drawn rather than photographed, so the differences shown are the ones that decide it: fuzzy circular growth beside flat kahm yeast, a new pellicle beside pink spoilage, texture and edge and whether it sits on the surface or grows out of it.

Eleven short rules covering salt percentages by weight, why nothing may sit above the brine, pH targets and which strips to buy, headspace, pressure and bottle failures, and the garlic in oil page. Cured meats, low acid canning and controlled temperature incubation are deliberately out of scope, and the app says so and points at the people who publish tested procedures.

Ferment is a notebook for a hobby. It is not a food safety authority, it makes no health or nutrition claims of any kind, and it cannot see inside your jar. Every triage page ends the way it should: if you are not sure, throw it out.

YOURS ALONE
Ferment does not request the internet permission. It cannot upload anything, because Android will not let it open a connection at all, and you can check that on this listing before you install. No sign up, no cloud, no analytics, no advertising ID.

Export the notebook as plain text or a JSON backup whenever you want, or erase everything in two taps.

Free and complete. No subscription, no in app purchase, no ads, and no locked batch count.

Start with the sauerkraut. It is very hard to ruin.

## Contact
Email: shayanm2002@gmail.com
Website: https://shayanmohd.github.io/ferment/
Privacy policy: https://shayanmohd.github.io/ferment/privacy-policy.html

## Declarations (read off the built manifest and the code, not assumed)
- Permissions declared, verified with `aapt2 dump permissions` on the release APK:
  `android.permission.VIBRATE`, `android.permission.CAMERA`, `android.permission.POST_NOTIFICATIONS`,
  plus the signature-level `com.mohdshayan.ferment.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` that
  androidx.core adds to every app. **No INTERNET.** No location, no storage, no microphone, no contacts.
- Hardware features: `android.hardware.camera` and `android.hardware.camera.autofocus` are both declared
  `required="false"`, because journal photos can also come from the device's own picker. Devices without a
  camera must not be excluded.
- Ads: none. No advertising SDK is present in the bundle.
- Data collected or shared: none. Nothing leaves the device, and the app cannot open a network connection.
- Advertising ID: not used.
- App access: every feature is available with no login of any kind.
- In-app purchases: none. There is no paywall and no gated feature.
- Photos and media: the app takes photographs with the camera and stores them in its own private
  IndexedDB store. It does not request access to the device photo library; the optional "pick a photo"
  fallback uses the system file chooser, which hands over one file the user selected and nothing else.
- Government, financial or health-device features: none. Ferment is a hobby notebook. It makes no health,
  nutrition, wellness or medical claims anywhere in the app, the listing or the website, and its food
  safety content is general information with an explicit "when in doubt, throw it out" rule.
- Target audience: 18 and over is not required; the content is suitable for 13+. Nothing in the app is
  directed at children and nothing is collected from anyone.
- Content rating questionnaire: no violence, no sexual content, no profanity, no gambling, no
  user-generated content, no user-to-user communication, no location sharing. The mead recipe involves
  making an alcoholic drink at home, which should be declared honestly if the questionnaire asks about
  references to alcohol.
- AI-generated assets: none. The icon and feature graphic are drawn procedurally in code from
  `store/brand.json`; the six triage illustrations are drawn in SVG by `web/js/charts.js`; the six
  screenshots are captures of the running app.
