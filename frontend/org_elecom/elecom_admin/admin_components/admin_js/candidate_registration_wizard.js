document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerCandidateForm');
  if (!form) return;
  const steps = [...form.querySelectorAll('.wizard-step')];
  const controls = [...form.querySelectorAll('[data-wizard-target]')];
  const back = document.getElementById('wizardBackBtn');
  const next = document.getElementById('wizardNextBtn');
  const submit = document.getElementById('submitBtn');
  const status = document.getElementById('wizardStepStatus');
  let current = 0, reached = 0;

  const show = (index, focus = false) => {
    current = index;
    steps.forEach((step, i) => {
      step.hidden = i !== current;
      step.classList.toggle('active', i === current);
    });
    controls.forEach((button, i) => {
      if (i === current) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
      button.classList.toggle('is-complete', i < current);
      button.disabled = i > reached || submit.disabled;
    });
    back.hidden = current === 0;
    next.hidden = current === steps.length - 1;
    submit.hidden = current !== steps.length - 1;
    back.disabled = next.disabled = submit.disabled;
    status.textContent = `Step ${current + 1} of ${steps.length}: ${steps[current].getAttribute('aria-label')}`;
    if (focus) steps[current].querySelector('h6').focus({preventScroll:true});
  };

  const validateStep = index => {
    if (index === 0 && !form.elements.student_id.value.trim()) {
      show(index); document.getElementById('studentLookup').focus();
      status.textContent = 'Search for and select a student before continuing.';
      document.getElementById('studentProfileSummary').textContent = 'Please search for and select a student account.';
      return false;
    }
    const invalid = [...steps[index].querySelectorAll('input,select,textarea')]
      .find(input => !input.disabled && !input.checkValidity());
    if (invalid) {
      show(index);
      const details = invalid.closest('details');
      if (details) details.open = true;
      invalid.focus(); invalid.reportValidity();
      return false;
    }
    if (index === 3 && !window.AdminCandidateCoc?.hasSignature()) {
      show(index); document.getElementById('candidateSignature').focus();
      status.textContent = 'The candidate must sign the COC before registration.';
      const alert = document.getElementById('errorAlert');
      alert.textContent = 'The candidate must sign the COC before registration.'; alert.style.display = 'block';
      return false;
    }
    return true;
  };
  const validateAll = () => {
    for (let i = 0; i < steps.length; i++) {
      if (!validateStep(i)) return false;
    }
    return true;
  };
  const advance = target => {
    if (submit.disabled) return;
    if (target > current) {
      for (let i = current; i < target; i++) if (!validateStep(i)) return;
    }
    reached = Math.max(reached, target);
    show(target, true);
  };
  back.addEventListener('click', () => advance(current - 1));
  next.addEventListener('click', () => advance(current + 1));
  controls.forEach(button => button.addEventListener('click', () => advance(Number(button.dataset.wizardTarget))));
  form.addEventListener('submit', event => {
    if (submit.disabled) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (current !== steps.length - 1) {
      event.preventDefault(); event.stopImmediatePropagation(); advance(current + 1); return;
    }
    if (!validateAll()) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  form.addEventListener('reset', () => queueMicrotask(() => { reached = 0; show(0); }));
  new MutationObserver(() => show(current)).observe(submit, {attributes:true,attributeFilter:['disabled']});
  window.CandidateRegistrationWizard = { validateAll };
  show(0);
});
