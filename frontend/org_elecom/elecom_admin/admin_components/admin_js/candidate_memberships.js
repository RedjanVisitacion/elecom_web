document.addEventListener("DOMContentLoaded", () => {
  const knownOrganizations = ["University Student Government (USG)", "Society of Information Technology Enthusiasts (SITE)", "Prime Association of Future Educators (PAFE)", "Association of Food Processing and Technology Students (AFPROTECHS)", "Active Certified Computer-Enhanced Student Society (ACCESS)", "Red Cross Youth (RCY)"];
  const generalPositions = ["President", "Vice President", "General Secretary", "Associate Secretary", "Treasurer", "Auditor", "Public Information Officer"];
  const representatives = ["BSIT Representative", "BTLED Representative", "BFPT Representative"];
  const form = document.getElementById('registerCandidateForm');
  const rows = [...form.querySelectorAll('.membership-row')];
  const get = (row, selector) => row.querySelector(selector);
  const yearBounds = row => {
    const now = new Date().getFullYear();
    const birth = Number(form.elements.date_of_birth.value.slice(0,4));
    const minimum = birth && birth <= now ? birth : now - 100;
    for (const selector of ['.membership-year-start','.membership-year-end']) {
      const slider = get(row,selector);
      slider.min = minimum; slider.max = now;
      slider.value = Math.max(minimum,Math.min(now,Number(slider.value) || now));
    }
    get(row,'.membership-year-end').value = Math.max(Number(get(row,'.membership-year-start').value), Number(get(row,'.membership-year-end').value));
    get(row,'.membership-year-output').textContent = `From ${get(row,'.membership-year-start').value} to ${get(row,'.membership-year-end').value}`;
  };
  const sync = row => {
    const org = get(row,'.membership-org-select');
    const otherOrg = get(row,'.membership-org-other');
    const orgValue = get(row,'.membership-org-value');
    const role = get(row,'.membership-position-select');
    const otherRole = get(row,'.membership-position-other');
    const roleValue = get(row,'.membership-position-value');
    const years = get(row,'.membership-years-value');
    const none = !org.value || org.value === 'None';
    otherOrg.hidden = org.value !== 'Others';
    otherOrg.disabled = row.hidden || otherOrg.hidden;
    otherOrg.required = !otherOrg.disabled;
    orgValue.value = org.value === 'Others' ? otherOrg.value.trim() : none ? '' : org.value;
    otherRole.hidden = role.value !== 'Others';
    otherRole.disabled = row.hidden || none || otherRole.hidden;
    otherRole.required = !otherRole.disabled;
    roleValue.value = role.value === 'Others' ? otherRole.value.trim() : role.value;
    role.disabled = row.hidden || none;
    role.required = !row.hidden && !none;
    org.required = !row.hidden && !!(years.value || roleValue.value);
    for (const selector of ['.membership-year-start','.membership-year-end','.membership-year-apply']) get(row,selector).disabled = row.hidden || none;
    get(row,'.membership-year-start').setCustomValidity(!row.hidden && !none && !years.value ? 'Select membership years, then click Use these years.' : '');
    get(row,'.membership-year-summary').textContent = years.value || 'Select start and end years';
    get(row,'.membership-year-picker').hidden = none;
  };
  const updateRoles = row => {
    const org = get(row,'.membership-org-select').value;
    const role = get(row,'.membership-position-select');
    const choices = [...(knownOrganizations.slice(0,4).includes(org) ? generalPositions : []), ...(org === knownOrganizations[0] ? representatives : []), 'Member','Others'];
    role.replaceChildren(new Option('Select position',''));
    choices.forEach(value => role.add(new Option(value,value)));
  };
  const clear = row => {
    row.querySelectorAll('input,select').forEach(input => { if (input.type !== 'range') input.value = ''; });
    get(row,'.membership-year-start').value = new Date().getFullYear()-1;
    get(row,'.membership-year-end').value = new Date().getFullYear();
    get(row,'.membership-year-picker').open = false;
    yearBounds(row); updateRoles(row); sync(row);
  };
  rows.forEach(row => {
    get(row,'.membership-org-select').addEventListener('change', () => {
      get(row,'.membership-org-other').value = '';
      get(row,'.membership-position-other').value = '';
      get(row,'.membership-position-value').value = '';
      if (get(row,'.membership-org-select').value === 'None') get(row,'.membership-years-value').value = '';
      updateRoles(row); sync(row);
      if (get(row,'.membership-org-select').value === 'Others') get(row,'.membership-org-other').focus();
    });
    get(row,'.membership-position-select').addEventListener('change', () => {get(row,'.membership-position-other').value=''; sync(row); if (get(row,'.membership-position-select').value === 'Others') get(row,'.membership-position-other').focus();});
    ['.membership-org-other','.membership-position-other'].forEach(selector => get(row,selector).addEventListener('input',()=>sync(row)));
    ['.membership-year-start','.membership-year-end'].forEach(selector => get(row,selector).addEventListener('input', () => {
      const start = get(row,'.membership-year-start'), end = get(row,'.membership-year-end');
      if (Number(start.value)>Number(end.value)) {
        if (selector === '.membership-year-start') end.value=start.value;
        else start.value=end.value;
      }
      get(row,'.membership-year-output').textContent = `From ${start.value} to ${end.value}`;
    }));
    get(row,'.membership-year-apply').addEventListener('click', () => {
      get(row,'.membership-years-value').value = `${get(row,'.membership-year-start').value}-${get(row,'.membership-year-end').value}`;
      get(row,'.membership-year-picker').open=false; sync(row);
      get(row,'.membership-year-picker').querySelector('summary').focus();
    });
    clear(row);
  });
  form.elements.date_of_birth.addEventListener('change', () => rows.forEach(row => {
    yearBounds(row);
    if (get(row,'.membership-years-value').value) get(row,'.membership-years-value').value = `${get(row,'.membership-year-start').value}-${get(row,'.membership-year-end').value}`;
    sync(row);
  }));
  window.CandidateMemberships = {sync, clear};
});
