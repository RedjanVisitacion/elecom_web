# Dynamic Omnibus Code pages

Mobile App Appearance now expands to Filing Cards and Omnibus Code. The existing filing editor remains independent. Both settings belong to the selected election; the current election supplies the mobile Home screen.

The Omnibus editor starts with the original 14 page images. Admins may add multiple JPG/PNG/WebP images (sorted by filename), replace a selected page, change page order, remove pages, or restore the originals. Keep 1–30 pages, up to 5 MB per image and 15 MB of new uploads per save. Use clear portrait document scans. Page images use the existing validated upload pipeline (EXIF orientation, stripped metadata, JPEG encoding within 1600 x 1600). Edits stay in a draft until Save Omnibus pages. Restore defaults publishes immediately after the styled confirmation.

GET/POST/DELETE /api/admin/elections/<id>/omnibus/ requires an administrator session, an existing election, and CSRF for writes. POST accepts pages JSON plus image_<page-id> multipart files. Only previously saved URLs for this election may be retained; new images must be uploaded. Every new page needs an image. All file content is validated before uploading; failed uploads preserve the previous database setting. Images already uploaded during a failed request may remain at Cloudinary. Replacing/removing pages does not delete remote assets.

Migration 0020_election_omnibus_pages creates election_omnibus_pages. The mobile election-window response includes omnibus_pages. The updated Flutter carousel and full-screen zoom reader use the same ordered images. Missing configuration retains the 14 bundled pages; an unsuccessful refresh retains the last successful in-memory data. There is no persistent offline cache for custom images. Older APKs keep their bundled Omnibus pages until updated.

Deploy the web/backend commit, run manage.py migrate, collectstatic --noinput, restart Gunicorn, then hard-refresh the admin page. Build/run the updated mobile app once. Later admin image changes need no APK rebuild. Actual production upload and phone rendering must be checked after deployment.

Checks: Django tests core.test_omnibus_appearance plus existing filing/turnout suites; node frontend/tests/omnibus_appearance.test.cjs and filing_slideshow.test.cjs; Flutter tests omnibus_code_carousel_test.dart and candidate_application_promo_test.dart.


Image framing: selecting an upload opens the shared crop dialog. Drag or focus the canvas and use arrow keys to position; adjust Zoom or Reset crop. Filing cards export JPEG at 1600 x 720. Omnibus offers a portrait 1131 x 1600 crop or Keep full image to avoid clipping document edges. Multiple Omnibus selections are framed one at a time; Cancel skips that image. Accepted crops still require Save to publish. The server validates the exported image using the existing upload rules. Cropping is performed locally in the browser, before upload. No migration or APK rebuild is needed for this editor-only crop feature.
