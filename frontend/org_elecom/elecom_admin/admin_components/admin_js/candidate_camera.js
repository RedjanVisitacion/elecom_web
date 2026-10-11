document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerCandidateForm');
  const modal = document.getElementById('candidateCameraModal');
  const open = document.getElementById('openCandidateCamera');
  const select = document.getElementById('candidateCameraSelect');
  const video = document.getElementById('candidateCameraVideo');
  const snapshot = document.getElementById('candidateCameraSnapshot');
  const status = document.getElementById('candidateCameraStatus');
  const capture = document.getElementById('candidateCameraCapture');
  const retake = document.getElementById('candidateCameraRetake');
  const use = document.getElementById('candidateCameraUse');
  const input = document.getElementById('candidate_photo');
  const thumbnail = document.getElementById('candidatePhotoThumbnail');
  let stream = null, session = 0, capturedBlob = null, snapshotUrl = null, thumbnailUrl = null;
  const clearSnapshot = () => {
    if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
    snapshotUrl = null; capturedBlob = null; snapshot.removeAttribute('src');
    snapshot.hidden = true; video.hidden = false; use.hidden = true; use.disabled = true;
    retake.hidden = true; capture.hidden = false;
  };
  const stop = () => {
    session++;
    stream?.getTracks().forEach(track => track.stop()); stream = null; video.srcObject = null;
    capture.disabled = true;
  };
  const start = async deviceId => {
    stop(); clearSnapshot(); const active = session;
    select.disabled = true; status.textContent = 'Opening camera…';
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera capture needs HTTPS or localhost. You can still upload a photo.');
      const incoming = await navigator.mediaDevices.getUserMedia({audio:false,video:{...(deviceId ? {deviceId:{exact:deviceId}} : {facingMode:'user'}),width:{ideal:1280},height:{ideal:720}}});
      if (active !== session) { incoming.getTracks().forEach(track => track.stop()); return; }
      stream = incoming; video.srcObject = stream; await video.play();
      if (active !== session) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (active !== session) return;
      select.replaceChildren();
      devices.filter(device => device.kind === 'videoinput').forEach((device,index) => select.add(new Option(device.label || `Camera ${index+1}`,device.deviceId)));
      const actual = stream.getVideoTracks()[0].getSettings().deviceId;
      if (actual) select.value = actual;
      capture.disabled = false; status.textContent = 'Position the candidate in the frame, then capture the photo.';
    } catch(error) {
      if (active !== session) return;
      stop();
      const messages = {NotAllowedError:'Camera permission was denied. Allow camera access in your browser, or upload a photo.',NotFoundError:'No camera was found. Connect a webcam or upload a photo.',NotReadableError:'The camera is busy. Close other camera apps and try again.',OverconstrainedError:'This camera is unavailable. Choose another camera or upload a photo.'};
      status.textContent = messages[error.name] || error.message || 'Could not open the camera.';
    } finally { if (active === session || !stream) select.disabled = false; }
  };
  open.addEventListener('click', () => bootstrap.Modal.getOrCreateInstance(modal).show());
  modal.addEventListener('shown.bs.modal', () => start(select.value));
  modal.addEventListener('hide.bs.modal', () => {stop(); clearSnapshot();});
  select.addEventListener('change', () => start(select.value));
  capture.addEventListener('click', () => {
    if (!stream || !video.videoWidth || !video.videoHeight) return;
    capture.disabled = true; const active = session;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video,0,0);
    canvas.toBlob(blob => {
      if (active !== session) return;
      if (!blob) {status.textContent='Could not capture the photo. Please try again.';capture.disabled=false;return;}
      capturedBlob = blob; snapshotUrl = URL.createObjectURL(blob); snapshot.src = snapshotUrl;
      snapshot.hidden=false; video.hidden=true; capture.hidden=true; retake.hidden=false; use.hidden=false; use.disabled=false;
      status.textContent = 'Review the photo. Use it or retake it.';
    },'image/jpeg',0.9);
  });
  retake.addEventListener('click', () => {clearSnapshot();capture.disabled=!stream;status.textContent='Position the candidate in the frame, then capture the photo.';});
  use.addEventListener('click', () => {
    if (!capturedBlob) return;
    try {
      const transfer = new DataTransfer(); transfer.items.add(new File([capturedBlob],'candidate-camera.jpg',{type:'image/jpeg'}));
      input.files = transfer.files; input.dispatchEvent(new Event('change',{bubbles:true}));
      bootstrap.Modal.getInstance(modal).hide();
    } catch(error) {status.textContent='This browser could not attach the captured photo. Please use a current browser or upload a photo.';}
  });
  const clearThumbnail = () => {if(thumbnailUrl)URL.revokeObjectURL(thumbnailUrl);thumbnailUrl=null;thumbnail.hidden=true;thumbnail.removeAttribute('src');};
  input.addEventListener('change', () => {
    clearThumbnail(); const file=input.files[0];
    if (file?.type.startsWith('image/')) {thumbnailUrl=URL.createObjectURL(file);thumbnail.src=thumbnailUrl;thumbnail.hidden=false;}
  });
  form.addEventListener('reset', () => {stop();clearSnapshot();clearThumbnail();});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {stop();clearSnapshot();status.textContent='Camera paused. Close and reopen this dialog to resume.';}
  });
  window.addEventListener('pagehide', () => {stop();clearSnapshot();clearThumbnail();});
});
