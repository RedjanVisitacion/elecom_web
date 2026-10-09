# PDF.js 4.10.38

Pinned browser and worker builds from the Mozilla `pdfjs-dist` package:

- https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs
- https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs
- https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/LICENSE

Used by COC management to render a full page within the preview panel, without
native PDF viewer scrollbars. Both builds must be upgraded together. Assets are
served locally through Django static files; production must run `collectstatic`.
The downloaded sample remains the original server-generated PDF.

The upstream `.mjs` files are stored as `pdf.min.js` and `pdf.worker.min.js`
to support Nginx installations that serve `.mjs` as application/octet-stream.
They remain ES modules; both files must be served with a JavaScript MIME type.
