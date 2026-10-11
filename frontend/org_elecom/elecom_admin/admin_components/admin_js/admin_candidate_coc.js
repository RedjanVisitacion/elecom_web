document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerCandidateForm');
  const search = document.getElementById('studentLookup');
  const results = document.getElementById('studentLookupResults');
  const photoInput = document.getElementById('candidate_photo');
  const profilePhoto = document.getElementById('selectedProfilePhoto');
  const organizationSelect = form.elements.organization;
  const programSelect = form.elements.program;
  let accountProgram = '', allowedOrganizations = [];
  programSelect.disabled = true;
  const applyEligibility = () => {
    for (const option of organizationSelect.options) {
      if (option.value) {
        const allowed = allowedOrganizations.includes(option.value.toUpperCase());
        option.hidden = !allowed; option.disabled = !allowed;
      }
    }
    if (!allowedOrganizations.includes(organizationSelect.value.toUpperCase())) organizationSelect.value = '';
    organizationSelect.dispatchEvent(new Event('change'));
    const ownRepresentative = `${accountProgram} Representative`;
    for (const option of form.elements.position.options) {
      if (/representative/i.test(option.value)) {
        const allowed = organizationSelect.value === 'USG' && option.value === ownRepresentative;
        option.hidden = !allowed; option.disabled = !allowed;
        if (!allowed && form.elements.position.value === option.value) form.elements.position.value = '';
      }
    }
  };
  organizationSelect.addEventListener('change', () => {
    const ownRepresentative = `${accountProgram} Representative`;
    for (const option of form.elements.position.options) {
      if (/representative/i.test(option.value)) {
        const allowed = organizationSelect.value === 'USG' && option.value === ownRepresentative;
        option.hidden = !allowed; option.disabled = !allowed;
        if (!allowed && form.elements.position.value === option.value) form.elements.position.value = '';
      }
    }
  });
  const canvas = document.getElementById('candidateSignature');
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
  let signed = false, drawing = false, debounce, controller, previewUrl;
  const notify = message => window.RegistrationNotifications.show('error', message);
  const fill = (name,value) => { const el = form.elements.namedItem(name); if (el) el.value = value || ''; };
  const chooseStudent = (student) => {
    accountProgram = student.program || '';
    allowedOrganizations = student.allowed_organizations || [];
    for (const name of ['student_id','first_name','middle_name','last_name','program','email','contact_number']) fill(name,student[name]);
    form.elements.program.dispatchEvent(new Event('change'));
    applyEligibility();
    const program = student.program || '';
    const section = student.section || '';
    const sectionCandidates = [section, `${program}-${section}`, `${program}-${student.year || ''}${section}`];
    const yearSection = sectionCandidates.find(value => [...form.elements.year_section.options].some(option => option.value === value));
    if (yearSection) fill('year_section',yearSection);
    const curricula = {BSIT:'Bachelor of Science in Information Technology',BTLED:'Bachelor of Technology and Livelihood Education',BFPT:'Bachelor of Food Processing Technology'};
    fill('curriculum_program',curricula[program] || program);
    profilePhoto.value = /^https?:\/\//i.test(student.photo_url || '') ? student.photo_url : '';
    photoInput.required = !profilePhoto.value;
    document.getElementById('studentProfileSummary').textContent = `Selected: ${student.first_name} ${student.last_name} (${student.student_id}). ${profilePhoto.value ? 'Profile photo will be used unless replaced.' : 'Upload a candidate photo.'}`;
    search.value = `${student.first_name} ${student.last_name}`;
    results.replaceChildren();
  };
  search.addEventListener('input', () => {
    clearTimeout(debounce); controller?.abort(); results.replaceChildren();
    const query = search.value.trim();
    if (query.length < 2) return;
    debounce = setTimeout(async () => {
      controller = new AbortController();
      const active = controller;
      try {
        const response = await fetch(`/api/admin/candidates/students/?q=${encodeURIComponent(query)}`,{credentials:'same-origin',signal:active.signal});
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || 'Student search failed.');
        if (active.signal.aborted) return;
        results.replaceChildren();
        for (const student of data.students) {
          const button = document.createElement('button'); button.type='button'; button.className='list-group-item list-group-item-action';
          button.textContent = `${student.first_name} ${student.middle_name || ''} ${student.last_name} — ${student.student_id} · ${student.program || ''}`;
          button.addEventListener('click', () => chooseStudent(student)); results.append(button);
        }
        if (!data.students.length) results.textContent='No matching student accounts.';
      } catch (error) { if (error.name !== 'AbortError') results.textContent=error.message; }
    },300);
  });
  const signatureStatus = document.getElementById('candidateSignatureStatus');
  const signatureFile = document.getElementById('candidateSignatureFile');
  let activePointer = null, signatureVersion = 0;
  const point = event => { const rect=canvas.getBoundingClientRect(); return [(event.clientX-rect.left)*canvas.width/rect.width,(event.clientY-rect.top)*canvas.height/rect.height]; };
  const drawPoint = event => {
    const [x,y] = point(event);
    ctx.lineWidth = event.pointerType === 'pen' && event.pressure > 0 ? 1 + 3 * event.pressure : 2;
    ctx.lineTo(x,y); ctx.stroke(); signed=true;
  };
  canvas.addEventListener('pointerdown', event => {
    if (event.isPrimary === false || event.button !== 0 || activePointer !== null) return;
    event.preventDefault(); signatureVersion++; activePointer=event.pointerId;
    canvas.setPointerCapture(event.pointerId); drawing=true;
    const [x,y]=point(event); ctx.beginPath();ctx.moveTo(x,y);
    signatureStatus.textContent = event.pointerType === 'pen' ? 'Pen / tablet input detected.' : 'Signature input active.';
  });
  canvas.addEventListener('pointermove', event => {
    if (!drawing || event.pointerId !== activePointer) return;
    event.preventDefault();
    const samples = event.getCoalescedEvents?.() || [];
    (samples.length ? samples : [event]).forEach(drawPoint);
  });
  canvas.addEventListener('pointerup', event => {
    if (event.pointerId !== activePointer) return;
    if (drawing) drawPoint(event);
    drawing=false; activePointer=null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    signatureStatus.textContent = 'Signature captured.';
  });
  ['pointercancel','lostpointercapture'].forEach(name => canvas.addEventListener(name,event=>{
    if (event.pointerId === activePointer) {drawing=false;activePointer=null;}
  }));
  const clear = () => {
    signatureVersion++; drawing=false;
    if (activePointer !== null && canvas.hasPointerCapture(activePointer)) canvas.releasePointerCapture(activePointer);
    activePointer=null;ctx.clearRect(0,0,canvas.width,canvas.height);signed=false;
    signatureFile.value='';signatureStatus.textContent='';
  };
  document.getElementById('clearCandidateSignature').addEventListener('click',clear);
  signatureFile.addEventListener('change',async () => {
    const file=signatureFile.files[0];
    if (!file) return;
    const version=++signatureVersion;
    try {
      if (file.type !== 'image/png' || file.size > 1024*1024) throw new Error('Import a signature PNG no larger than 1 MB.');
      const bitmap=await createImageBitmap(file);
      if (version !== signatureVersion) {bitmap.close();return;}
      const scratch=document.createElement('canvas');scratch.width=canvas.width;scratch.height=canvas.height;
      const context=scratch.getContext('2d');
      const scale=Math.min((canvas.width-20)/bitmap.width,(canvas.height-20)/bitmap.height);
      const width=bitmap.width*scale,height=bitmap.height*scale;
      context.drawImage(bitmap,(canvas.width-width)/2,(canvas.height-height)/2,width,height);bitmap.close();
      const pixels=context.getImageData(0,0,scratch.width,scratch.height).data;
      let ink=0;
      for(let i=0;i<pixels.length;i+=4) if(pixels[i+3]>0 && Math.min(pixels[i],pixels[i+1],pixels[i+2])<240) ink++;
      if(ink<10) throw new Error('The PNG must contain a visible signature.');
      ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(scratch,0,0);signed=true;
      signatureStatus.textContent='Imported signature. Please review it before confirming.';
    } catch(error) {signatureStatus.textContent=error.message;signatureFile.value='';}
  });
  const readBase64 = blob => new Promise((resolve,reject) => { const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Could not read the photo.'));reader.readAsDataURL(blob); });
  const augment = async payload => {
    if (!form.elements.student_id.value) throw new Error('Search for and select a student first.');
    if (!signed) throw new Error('The candidate must sign the COC before registration.');
    let photo=photoInput.files[0];
    if (!photo && profilePhoto.value) {
      const response=await fetch(profilePhoto.value);
      if (!response.ok) throw new Error('Could not load the profile photo. Please upload a candidate photo.');
      photo=await response.blob();
    }
    if (!photo || photo.size > 8*1024*1024) throw new Error('Select a candidate photo no larger than 8 MB.');
    const fields=Object.fromEntries(new FormData(form));
    for (const [key,value] of Object.entries(fields)) if (typeof value==='string' && !['party_code','coc_confirmed'].includes(key)) payload[key]=value;
    payload.program=accountProgram;
    payload.admin_coc=true; payload.signature_base64=canvas.toDataURL('image/png').split(',')[1];
    const bitmap = await createImageBitmap(photo);
    const scale = Math.min(1,1024/Math.max(bitmap.width,bitmap.height));
    const resized = document.createElement('canvas');
    resized.width=Math.max(1,Math.round(bitmap.width*scale)); resized.height=Math.max(1,Math.round(bitmap.height*scale));
    const imageContext=resized.getContext('2d'); imageContext.fillStyle='#fff';imageContext.fillRect(0,0,resized.width,resized.height);
    imageContext.drawImage(bitmap,0,0,resized.width,resized.height); bitmap.close();
    const certificatePhoto = await new Promise(resolve => resized.toBlob(resolve,'image/jpeg',0.85));
    if (!certificatePhoto || certificatePhoto.size > 1024*1024) throw new Error('Use a smaller candidate photo for the COC.');
    payload.photo_base64=await readBase64(certificatePhoto);
    payload.photo_url=profilePhoto.value || '';
    return payload;
  };
  const previewButton=document.getElementById('previewAdminCoc');
  previewButton.addEventListener('click',async () => {
    if (!(window.CandidateRegistrationWizard ? window.CandidateRegistrationWizard.validateAll() : form.reportValidity())) return;
    previewButton.disabled=true;
    try {
      const payload=await augment({});
      const response=await fetch('/api/admin/candidates/coc-preview/',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if (!response.ok) { const data=await response.json();throw new Error(data.error || 'COC preview failed.'); }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl=URL.createObjectURL(await response.blob());
      document.getElementById('adminCocPreviewFrame').src=previewUrl;
      bootstrap.Modal.getOrCreateInstance(document.getElementById('adminCocPreviewModal')).show();
    } catch(error) {notify(error.message);} finally {previewButton.disabled=false;}
  });
  window.AdminCandidateCoc = {
    augment,
    hasSignature: () => signed,
    reset: () => {accountProgram='';allowedOrganizations=[];applyEligibility();clear(); profilePhoto.value='';photoInput.required=true;search.value='';results.replaceChildren();document.getElementById('studentProfileSummary').textContent='';},
    showCertificate: data => {const link=document.getElementById('registeredCocLink');if(data.certificate_url){link.href=data.certificate_url;link.classList.remove('d-none');}}
  };
  applyEligibility();
  window.addEventListener('pagehide',()=>{controller?.abort();if(previewUrl)URL.revokeObjectURL(previewUrl);});
});
