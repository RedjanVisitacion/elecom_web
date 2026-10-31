/* Keep phone layouts readable when a browser requests a desktop viewport. */
(function () {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) return;
  const touch = navigator.maxTouchPoints > 0;
  let lastWidth = null;
  const updateViewport = () => {
    const width = Math.round(window.screen.width);
    const phone = touch && Math.min(screen.width, screen.height) <= 600;
    if (!phone || width <= 0) return;
    if (width === lastWidth) return;
    lastWidth = width;
    // An explicit screen width also handles desktop mode's usual 980px layout.
    // Do not restrict pinch zoom or react to visualViewport/keyboard changes.
    viewport.content = `width=${width}, initial-scale=1, viewport-fit=cover`;
  };
  updateViewport();
  window.addEventListener('orientationchange', () => {
    lastWidth = null;
    updateViewport();
  });
  window.addEventListener('resize', updateViewport);
})();