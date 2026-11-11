/* Local image framing. Only the accepted crop enters the upload draft. */
(() => {
  const el = id => document.getElementById(id);
  const dialog = el('appearanceCropModal');
  if (!dialog) return;
  const canvas = el('appearanceCropCanvas'), context = canvas.getContext('2d');
  const range = el('appearanceCropZoom'), apply = el('appearanceCropApply');
  const modal = new bootstrap.Modal(dialog);
  let active = false;
  window.ElecomImageCrop = (file, kind = 'filing') => new Promise(resolve => {
    if (active) { resolve(null); return; }
    active = true;
    const originalFocus = document.activeElement;
    const image = new Image(), url = URL.createObjectURL(file);
    const portrait = kind === 'omnibus', topbar = kind === 'topbar';
    canvas.width = portrait ? 1131 : topbar ? 1560 : 1600; canvas.height = portrait ? 1600 : topbar ? 680 : 720;
    el('appearanceCropTitle').textContent = portrait ? 'Crop Omnibus page' : topbar ? 'Crop top bar background' : 'Crop filing card';
    el('appearanceCropHelp').textContent = portrait ? 'Portrait page · 1131 × 1600. Drag to position the document, then zoom to select the area. Keep full image preserves every edge.' : 'Filing card · 1600 × 720. Drag to position the image and zoom to select the area. Keep the left side clear for text.';
    if (topbar) el('appearanceCropHelp').textContent = 'Top bar · 1560 × 680. Drag or use arrow keys to position the background, then adjust zoom. Keep the greeting area clear.';
    el('appearanceCropOriginal').hidden = !portrait;
    let result = null, zoom = 1, offsetX = 0, offsetY = 0, pointer = null, encoding = false, closed = false;
    range.value = '1'; apply.disabled = false;
    const scale = () => Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight) * zoom;
    const draw = () => {
      const factor = scale(), width = image.naturalWidth * factor, height = image.naturalHeight * factor;
      offsetX = Math.max(-(width-canvas.width)/2, Math.min((width-canvas.width)/2,offsetX));
      offsetY = Math.max(-(height-canvas.height)/2, Math.min((height-canvas.height)/2,offsetY));
      context.fillStyle = '#fff'; context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(image,(canvas.width-width)/2+offsetX,(canvas.height-height)/2+offsetY,width,height);
    };
    const reset = () => { zoom = 1; offsetX = offsetY = 0; range.value = '1'; draw(); };
    const changeZoom = () => { zoom = Number(range.value); draw(); };
    const down = event => { if (encoding) return; pointer = {id:event.pointerId,x:event.clientX,y:event.clientY}; canvas.setPointerCapture(event.pointerId); };
    const move = event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const bounds = canvas.getBoundingClientRect();
      offsetX += (event.clientX-pointer.x)*canvas.width/bounds.width;
      offsetY += (event.clientY-pointer.y)*canvas.height/bounds.height;
      pointer.x = event.clientX; pointer.y = event.clientY; draw();
    };
    const up = () => { pointer = null; };
    const key = event => {
      const deltas = {ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};
      if (!deltas[event.key] || encoding) return;
      event.preventDefault(); offsetX += deltas[event.key][0]; offsetY += deltas[event.key][1]; draw();
    };
    const accept = () => {
      if (encoding) return; encoding = true; apply.disabled = true;
      canvas.toBlob(blob => {
        if (closed) return;
        if (!blob) { encoding = false; apply.disabled = false; return; }
        result = new File([blob], file.name.replace(/\.[^.]+$/, '') + '-cropped.jpg', {type:'image/jpeg'});
        modal.hide();
      }, 'image/jpeg', .92);
    };
    const keepOriginal = () => { if (!encoding) { result = file; modal.hide(); } };
    const cleanup = () => {
      closed = true;
      range.removeEventListener('input',changeZoom); apply.removeEventListener('click',accept);
      el('appearanceCropReset').removeEventListener('click',reset); el('appearanceCropOriginal').removeEventListener('click',keepOriginal);
      canvas.removeEventListener('keydown',key); canvas.removeEventListener('pointerdown',down); canvas.removeEventListener('pointermove',move); canvas.removeEventListener('pointerup',up); canvas.removeEventListener('pointercancel',up);
      URL.revokeObjectURL(url); active = false; originalFocus?.focus(); resolve(result);
    };
    image.onerror = () => { URL.revokeObjectURL(url); active = false; resolve(null); };
    image.onload = () => {
      range.addEventListener('input',changeZoom); apply.addEventListener('click',accept);
      el('appearanceCropReset').addEventListener('click',reset); el('appearanceCropOriginal').addEventListener('click',keepOriginal);
      canvas.addEventListener('keydown',key); canvas.addEventListener('pointerdown',down); canvas.addEventListener('pointermove',move); canvas.addEventListener('pointerup',up); canvas.addEventListener('pointercancel',up);
      dialog.addEventListener('hidden.bs.modal',cleanup,{once:true}); draw(); modal.show();
    };
    image.src = url;
  });
})();
