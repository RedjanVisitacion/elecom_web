// Drafts stay in this browser tab's admin session; files use IndexedDB structured clones.
document.addEventListener('DOMContentLoaded', async () => {
  const form=document.getElementById('registerCandidateForm');
  if (!form) return;
  const scope=sessionStorage.getItem('elecom_admin_page_hash');
  if (!scope) return;
  let tab=sessionStorage.getItem('elecom_registration_draft_tab');
  if (!tab) { tab=crypto.randomUUID(); sessionStorage.setItem('elecom_registration_draft_tab',tab); }
  const key=`${scope}:${tab}`;
  const controls=[...form.querySelectorAll('input,select,textarea')];
  const eligible=el => !['button','submit','reset','password'].includes(el.type);
  let db, restoring=true, cleared=false;
  const warning=() => window.RegistrationNotifications.show('error','The registration draft could not be saved in this browser. Keep this page open to retain your entries.');
  const snapshot=() => ({updated:Date.now(), fields:controls.map(el => eligible(el) ? {
    value:el.type==='file' ? undefined : el.value,
    checked:el.checked,
    files:el.type==='file' ? [...el.files] : undefined
  } : null), party:window.AdminCandidatePartyPicker.draftState(), coc:window.AdminCandidateCoc.draftState(), wizard:window.CandidateRegistrationWizard.draftState()});
  const save=() => {
    if (!db || restoring || cleared) return;
    try {
      const tx=db.transaction('drafts','readwrite');
      tx.objectStore('drafts').put(snapshot(),key);
      tx.onabort=warning;
    } catch { warning(); }
  };
  form.inert=true;
  try {
    db=await new Promise((resolve,reject) => {
      const request=indexedDB.open('elecom-candidate-registration',1);
      request.onupgradeneeded=() => request.result.createObjectStore('drafts');
      request.onsuccess=() => resolve(request.result);
      request.onerror=() => reject(request.error);
    });
    const draft=await new Promise((resolve,reject) => {
      const request=db.transaction('drafts').objectStore('drafts').get(key);
      request.onsuccess=() => resolve(request.result);
      request.onerror=() => reject(request.error);
    });
    if (draft && Date.now()-draft.updated<24*60*60*1000) {
      const fill=() => controls.forEach((el,index) => {
        const field=draft.fields[index];
        if (!field || !eligible(el)) return;
        if (el.type==='file') {
          const transfer=new DataTransfer(); (field.files || []).forEach(file => transfer.items.add(file)); el.files=transfer.files;
        } else { el.value=field.value; if (['checkbox','radio'].includes(el.type)) el.checked=field.checked; }
      });
      // Populate dependent options before restoring their selected values.
      fill();
      await window.AdminCandidateCoc.restoreDraft(draft.coc);
      controls.filter(el => el.tagName==='SELECT').forEach(el => el.dispatchEvent(new Event('change',{bubbles:true})));
      fill();
      controls.filter(el => ['radio','checkbox'].includes(el.type) && el.checked).forEach(el => el.dispatchEvent(new Event('change',{bubbles:true})));
      window.CandidateRegistrationWizard.restoreDraft(draft.wizard);
      if (draft.party) await window.AdminCandidatePartyPicker.restoreDraft(draft.party);
      controls.filter(el => el.type==='file' && el.files.length && el.id!=='candidateSignatureFile').forEach(el => el.dispatchEvent(new Event('change',{bubbles:true})));
      await window.AdminCandidateCoc.checkRestoredCandidate();
      if (!window.AdminCandidateCoc.eligibilityError()) window.RegistrationNotifications.show('success','Your unfinished registration has been restored.');
    }
  } catch { warning(); }
  finally { restoring=false; form.inert=false; }
  ['input','change','pointerup','pointercancel'].forEach(event => form.addEventListener(event,() => {
    cleared=false; queueMicrotask(save);
  }));
  form.addEventListener('click',() => queueMicrotask(save));
  form.addEventListener('reset',() => {
    cleared=true;
    if (db) db.transaction('drafts','readwrite').objectStore('drafts').delete(key);
  });
  window.addEventListener('pagehide',save);
  document.addEventListener('visibilitychange',() => { if (document.hidden) save(); });
});
