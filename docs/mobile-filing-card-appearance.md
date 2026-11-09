# Mobile candidacy filing-card background

In Election Management, each saved election has a Mobile App Appearance button. The modal contains a live card preview, upload chooser, Save changes, and Reset to default. Uploads affect only that election and do not change its schedule, candidacy rules or any student records.

A custom image replaces the five-slide bundled filing-card carousel with one Ready to Serve? card. The File now action and readable dark overlay remain. Reset removes the stored override and restores the bundled carousel. The preview shows a representative default slide, not the entire carousel.

## Image rules and storage

JPG, PNG and WebP are accepted, up to 5 MB. Both dimensions must be between 100 and 4096 pixels. Recommended artwork is 1600 x 720 (roughly 2.22:1), with clear space on the left for text. The image fills the card and can crop at the edges. The server verifies the actual image, applies EXIF orientation, strips metadata, resizes within 1600 x 1600 and re-encodes it as JPEG. File extensions and browser MIME types alone are not trusted.

Images use the existing server-side Cloudinary configuration. No Cloudinary credentials are added to Flutter or the browser. Each upload receives a fresh Cloudinary URL, avoiding stale image caches. Replaced Cloudinary files are retained; resetting the card removes only the election's database reference, not remote files that could be referenced elsewhere.

Admin API: GET/POST/DELETE /api/admin/elections/<id>/appearance/. It requires an admin session, an existing election, and CSRF for changes. POST accepts multipart background. Arbitrary remote URLs are not accepted. GET and save/reset responses are private/no-store. Upload/save failure preserves the existing appearance record.

The election_mobile_appearance table is created by migration elecom_voting.0018_election_mobile_appearance. The admin endpoint also creates it idempotently for compatibility with the repository's existing system-table setup. Reading an old deployment before the table exists falls back to the bundled card. The mobile election-window response adds filing_card_background for the same window_id it returns, without modifying turnout queries.

## Deployment and validation

Deploy the backend and frontend files, install current requirements if needed, run manage.py migrate, collectstatic --noinput, then restart Gunicorn. The frontend script version was bumped. Existing Firebase and Cloudinary settings are unchanged.

Build/install an updated Flutter app once. The dashboard uses its existing three-second foreground refresh, pull-to-refresh and resume refresh to obtain the background. Later artwork changes require no new APK. When offline, the last successfully fetched configuration remains in memory; if the remote image cannot load, a bundled background is displayed. This does not add persistent offline image caching.

Run manage.py test core.test_election_appearance core.test_mobile_turnout --noinput and manage.py check. On mobile, run flutter test test/candidate_application_promo_test.dart, then flutter analyze. Syntax-check election_appearance.js and elecom_elections.js with node --check.

The tests use mocked image hosting/database access; they do not establish a live Cloudinary upload or production device refresh. Verify a real image save, mobile update, election isolation and reset after deployment.
