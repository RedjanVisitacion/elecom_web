# Mobile candidacy filing slideshow

Open Mobile App Appearance in the admin sidebar. The current election is selected initially; choose another election to edit its slideshow independently. Editing another election does not change the current mobile Home screen.

The editor starts with the app's five provided slides. Select a slide to change its image, select a provided design/text preset, or uncheck Use provided text to write a custom title and description. Add slide creates another editable slide; arrows change its order, and Remove deletes it from the draft. Keep between 1 and 10 slides. Titles are limited to 60 characters and descriptions to 160. Text may be clipped to fit the card, so inspect the preview and keep copy concise.

Play preview rotates every four seconds. The preview's File now button is illustrative; the real mobile button retains the existing candidacy filing action. Uploaded images, text and ordering are draft changes until Save slideshow publishes the entire ordered list. Switching elections or leaving warns about unsaved edits. Restore all default slides, after confirmation, immediately restores the five bundled images and provided text for that election.

## Images and security

JPG, PNG and WebP are accepted, up to 5 MB each and 15 MB of new uploads per save. Both dimensions must be between 100 and 4096 pixels. Recommended artwork: 1600 x 720 with clear space on the left. The server checks actual image content, applies EXIF orientation, strips metadata, resizes within 1600 x 1600 and re-encodes as JPEG. All files are validated before remote uploads begin. Database publication happens only after every upload succeeds; a failed save preserves the previous slideshow, although already-uploaded orphan images can remain at Cloudinary.

Credentials remain server-side. Existing saved Cloudinary URLs can be retained; arbitrary new remote image URLs are rejected. Image uploads use the existing Cloudinary configuration. Images are not deleted from Cloudinary when replaced/removed/reset, so references elsewhere are not destroyed. Frontend text uses textContent, and mobile uses plain Text widgets.

## API and compatibility

Admin GET/POST/DELETE /api/admin/elections/<id>/appearance/ requires an admin session, an existing election and CSRF for mutations. GET returns slides, defaults and a CSRF token. POST accepts multipart slides (JSON ordered array) and image_<slide-id> files. Each slide includes id, default_index (0-4), use_default_text, title, subtitle and image_url (null for a bundled image). The server supplies the actual provided text when use_default_text is true. DELETE removes the override and returns all defaults.

Migration elecom_voting.0019_election_filing_slideshow adds nullable JSONB slides to the existing election_mobile_appearance table. Old single-background settings become one editable Ready to Serve? slide without losing the image. The previous single-image API and filing_card_background response remain for compatibility. Before the new schema is installed, the slideshow reader safely falls back to defaults.

The mobile election-window response adds filing_card_slides for the same window_id. The new app renders the ordered slides, retaining bundled image fallbacks, dots, swiping and four-second auto-advance. Polling identical slide data does not reset the carousel. Updates are picked up through the existing foreground, pull-to-refresh and resume refresh. Persistent offline image caching is not added.

## Deployment and verification

Deploy backend/frontend changes, run manage.py migrate, collectstatic --noinput, restart Gunicorn, and hard-refresh the browser. New editor JS/CSS versions were bumped and all five default previews are supplied as static assets. Build/install the updated Flutter app once; later slideshow changes do not require another APK.

Backend checks: manage.py test core.test_filing_slideshow core.test_election_appearance core.test_mobile_turnout --noinput; manage.py check.
Browser editor: node frontend/tests/filing_slideshow.test.cjs; node --check on election_appearance.js.
Mobile: flutter test test/candidate_application_promo_test.dart; flutter analyze.

The tests use mocked database/hosting/browser APIs. After deployment verify a real multi-image save, custom text, slide order, automatic mobile refresh, reset and offline image fallback. Passing tests do not establish production upload/device behavior.
