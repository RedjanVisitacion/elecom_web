document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerCandidateForm');
  const select = document.getElementById('existingPartySelect');
  const name = document.getElementById('party_name');
  const logoInput = document.getElementById('party_logo');
  const zone = document.getElementById('partyLogoUploadZone');
  const shared = document.getElementById('sharedPartyLogo');
  const image = document.getElementById('sharedPartyLogoImage');
  const status = document.getElementById('partyPickerStatus');
  let parties = [], requestVersion = 0;
  const selectedParty = () => parties.find(party => party.name === select.selectedOptions[0]?.dataset.partyName);
  const sync = () => {
    const political = document.getElementById('type_party').checked;
    const party = selectedParty();
    select.disabled = !political;
    select.required = political;
    name.readOnly = select.value !== 'new';
    if (party) name.value = party.name;
    else if (select.value !== 'new') name.value = '';
    const logo = party?.logo_url;
    const hasLogo = political && /^https?:\/\//i.test(logo || '');
    shared.hidden = !hasLogo;
    zone.hidden = !!hasLogo;
    logoInput.disabled = !political || !!hasLogo;
    if (hasLogo) {
      image.hidden = false;
      shared.querySelector("p").textContent = "This shared party logo will be used automatically.";
      image.src = logo;
    }
    else image.removeAttribute('src');
  };
  select.addEventListener('change', () => {
    name.value = '';
    logoInput.value = '';
    zone.querySelector('.upload-filename').textContent = 'No file selected';
    sync();
    if (select.value === 'new') name.focus();
  });
  image.addEventListener('error', () => {
    image.hidden = true;
    shared.querySelector('p').textContent = 'Shared logo preview is unavailable. The saved party logo will still be used.';
  });
  const load = async () => {
    const version = ++requestVersion;
    const previous = selectedParty()?.name;
    status.textContent = 'Loading existing parties…';
    try {
      const response = await fetch('/api/admin/candidates/parties/',{credentials:'same-origin'});
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load existing parties.');
      if (version !== requestVersion) return;
      parties = data.parties;
      const current = select.value;
      select.replaceChildren(new Option('Select an existing party or create a new one',''));
      parties.forEach((party,index) => {
        const option = new Option(party.name,`party-${index}`);
        option.dataset.partyName = party.name;
        select.add(option);
      });
      select.add(new Option('Create new party','new'));
      const match = [...select.options].find(option => previous && option.dataset.partyName === previous);
      select.value = match?.value || (current === 'new' ? 'new' : '');
      status.textContent = parties.length ? 'Select a party from this election, or create a new one.' : 'No parties exist in this election yet. Choose Create new party.';
      sync();
    } catch(error) { if (version === requestVersion) status.textContent = `${error.message} Reopen this dropdown to retry.`; }
  };
  select.addEventListener('focus', load);
  form.addEventListener('reset', () => queueMicrotask(() => {select.value='';sync();load();}));
  window.AdminCandidatePartyPicker = {sync};
  sync(); load();
});
