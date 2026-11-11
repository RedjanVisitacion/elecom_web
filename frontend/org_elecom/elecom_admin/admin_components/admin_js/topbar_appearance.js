(() => {
 const el=id=>document.getElementById(id); if(!el('topbarPanel'))return;
 const defaultImage='/static/assets/mobile-topbar-default.png', election=el('topbarElection'), input=el('topbarFile');
 let electionId,csrf,loading=true,file=null,localUrl=null,savedUrl=null;
 const endpoint=()=>`/api/admin/elections/${encodeURIComponent(electionId)}/topbar/`;
 const notice=(text,error=false)=>{el('topbarMessage').textContent=text;el('topbarMessage').className=`small mt-3 ${error?'text-danger':'text-muted'}`};
 const clear=()=>{if(localUrl)URL.revokeObjectURL(localUrl);localUrl=null;file=null;input.value=''};
 const render=()=>{election.disabled=loading;input.disabled=loading||!csrf;el('topbarSave').disabled=loading||!csrf||!file;el('topbarReset').disabled=loading||!csrf;el('topbarPreview').src=localUrl||savedUrl||defaultImage};
 const modalElement=el('filingConfirmModal'),modal=new bootstrap.Modal(modalElement);let pending=false;
 const ask=(heading,detail,action)=>new Promise(resolve=>{
  if(pending){resolve(false);return}pending=true;
  el('filingConfirmTitle').textContent=heading;el('filingConfirmDescription').textContent=detail;const button=el('filingConfirmAccept');button.textContent=action;let accepted=false;
  const yes=()=>{accepted=true;modal.hide()};button.addEventListener('click',yes);
  modalElement.addEventListener('hidden.bs.modal',()=>{button.removeEventListener('click',yes);pending=false;resolve(accepted)},{once:true});modal.show();
 });
 const load=async()=>{
  loading=true;csrf=null;render();notice('Loading background...');
  try{const response=await fetch(endpoint(),{credentials:'same-origin',cache:'no-store'}),data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||'Unable to load background.');clear();savedUrl=data.image_url;csrf=data.csrfToken;notice('Select an image to crop and preview. Save to publish.')}
  catch(error){notice(error.message,true)}finally{loading=false;render()}
 };
 election.addEventListener('change',async()=>{if(file&&!(await ask('Switch election?','Unsaved background changes will be discarded.','Discard and switch'))){election.value=String(electionId);return}electionId=election.value;await load()});
 input.addEventListener('change',async()=>{
  const selected=input.files[0];if(!selected||loading)return;
  if(!['image/jpeg','image/png','image/webp'].includes(selected.type)||selected.size>5*1024*1024){input.value='';notice('Choose a JPG, PNG or WebP image up to 5 MB.',true);return}
  loading=true;render();const cropped=await window.ElecomImageCrop(selected,'topbar');loading=false;
  if(cropped){clear();file=cropped;localUrl=URL.createObjectURL(file);notice('Unsaved background. Save to publish.')}else input.value='';render();
 });
 el('topbarSave').addEventListener('click',async()=>{
  if(loading||!csrf||!file)return;const body=new FormData();body.append('background',file);loading=true;render();notice('Saving background...');
  try{const response=await fetch(endpoint(),{method:'POST',credentials:'same-origin',headers:{'X-CSRFToken':csrf},body}),data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||'Unable to save background.');savedUrl=data.image_url;clear();notice('Background saved. The updated mobile app will refresh automatically.')}
  catch(error){notice(error.message,true)}finally{loading=false;render()}
 });
 el('topbarReset').addEventListener('click',async()=>{
  if(loading||!csrf||!(await ask('Restore default background?','Replace this election’s top bar background with the original campus image?','Restore default')))return;
  loading=true;render();
  try{const response=await fetch(endpoint(),{method:'DELETE',credentials:'same-origin',headers:{'X-CSRFToken':csrf}}),data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||'Unable to restore background.');savedUrl=null;clear();notice('Default campus background restored.')}
  catch(error){notice(error.message,true)}finally{loading=false;render()}
 });
 el('topbarPreview').addEventListener('error',()=>{if(el('topbarPreview').getAttribute('src')!==defaultImage)el('topbarPreview').src=defaultImage});
 window.addEventListener('beforeunload',event=>{if(file){event.preventDefault();event.returnValue=''}});window.addEventListener('pagehide',clear);
 (async()=>{try{const response=await fetch('/api/admin/elections/',{credentials:'same-origin',cache:'no-store'}),data=await response.json();if(!response.ok||!data.ok||!data.elections?.length)throw new Error('No elections available.');data.elections.forEach(item=>{const option=document.createElement('option');option.value=String(item.id);option.textContent=item.name+(item.is_active?' — Current':'');election.append(option)});electionId=(data.elections.find(item=>item.is_active)||data.elections[0]).id;election.value=String(electionId);await load()}catch(error){notice(error.message,true)}})();
})();
