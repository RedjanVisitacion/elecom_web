window.RegistrationNotifications = {
  show(type, message) {
    const element = document.getElementById('registrationToast');
    const error = type === 'error';
    document.getElementById('registrationToastTitle').textContent = error ? 'Please check registration' : type === 'warning' ? 'Party availability' : 'Changes saved';
    document.getElementById('registrationToastBody').textContent = String(message || '');
    document.getElementById('registrationToastIcon').className = `bi ${error ? 'bi-exclamation-circle-fill text-danger' : type === 'warning' ? 'bi-exclamation-triangle-fill text-warning' : 'bi-check-circle-fill text-success'} me-2`;
    element.setAttribute('role',error ? 'alert' : 'status');
    element.setAttribute('aria-live',error ? 'assertive' : 'polite');
    const previous = bootstrap.Toast.getInstance(element);
    if (previous) previous.dispose();
    new bootstrap.Toast(element,{autohide:!error && !/security code/i.test(message),delay:6000}).show();
  }
};
