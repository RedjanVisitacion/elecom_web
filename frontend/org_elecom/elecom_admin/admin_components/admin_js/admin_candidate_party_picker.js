document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerCandidateForm');
  const select = document.getElementById('existingPartySelect');
  const name = document.getElementById('party_name');
  const logoInput = document.getElementById('party_logo');
  const zone = document.getElementById('partyLogoUploadZone');
  const shared = document.getElementById('sharedPartyLogo');
  const image = document.getElementById('sharedPartyLogoImage');
  const status = document.getElementById('partyPickerStatus');
  const capacityStatus = document.getElementById('partyCapacityStatus');
  const organization = form.elements.organization;
  const position = form.elements.position;
  let loadedOrganization = '', parties = [], requestVersion = 0;
  const selectedParty = () => parties.find(party => party.name === select.selectedOptions[0]?.dataset.partyName);
  const updateCapacity = () => {
    const political = document.getElementById('type_party').checked;
    const party = political && loadedOrganization === organization.value ? selectedParty() : null;
    for (const option of position.options) {
      if (!option.value) continue;
      option.dataset.baseLabel ||= option.textContent;
      const slot = party?.positions?.[option.value];
      const full = slot && slot.used >= slot.limit;
      const eligible = !/representative/i.test(option.value) || (organization.value === 'USG' && option.value === `${form.elements.program.value} Representative`);
      option.disabled = !eligible || !!full;
      option.textContent = option.dataset.baseLabel + (full ? ` (Full: ${slot.used}/${slot.limit})` : '');
    }
    const slot = party?.positions?.[position.value];
    const full = slot && slot.used >= slot.limit;
    select.setCustomValidity(full ? 'This party position is full. Go Back to Candidate Info and choose another position, or select another party.' : '');
    capacityStatus.classList.toggle('text-danger', !!full);
    capacityStatus.textContent = slot ? `${party.name}: ${slot.used} of ${slot.limit} slots used for ${position.value} in ${organization.value}.${full ? ' This position is full; choose another position or party.' : ''}` : '';
  };
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
    updateCapacity();
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
    const requestedOrganization = organization.value;
    status.textContent = 'Loading existing parties…';
    try {
      const response = await fetch(`/api/admin/candidates/parties/?organization=${encodeURIComponent(requestedOrganization)}`,{credentials:'same-origin'});
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load existing parties.');
      if (version !== requestVersion) return;
      parties = data.parties;
      loadedOrganization = requestedOrganization;
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
  organization.addEventListener('change', () => {updateCapacity();load();});
  position.addEventListener('change', updateCapacity);
  form.addEventListener('reset', () => queueMicrotask(() => {select.value='';sync();load();}));
  window.AdminCandidatePartyPicker = {sync};
  sync(); load();
});
