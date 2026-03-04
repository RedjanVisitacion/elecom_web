(() => {
  const $ = (id) => document.getElementById(id);

  const form = $("loginForm");
  const studentId = $("studentId");
  const password = $("password");
  const togglePassword = $("togglePassword");
  const submitBtn = $("submitBtn");
  const fillAdmin = $("fillAdmin");
  const fillStudent = $("fillStudent");
  const studentIdError = $("studentIdError");
  const passwordError = $("passwordError");
  const formStatus = $("formStatus");
  const year = $("year");

  if (year) year.textContent = String(new Date().getFullYear());

  if (studentId) studentId.value = "";
  if (password) password.value = "";

  const SAMPLE_USERS = {
    admin: {
      username: "admin",
      password: "Admin@123",
      role: "admin",
      redirect: "./elecom_admin/admin_dashboard.html",
    },
    student: {
      username: "2023-00123",
      password: "Student@123",
      role: "student",
      redirect: "./elecom_user/user_dashboard.html",
    },
  };

  const setBusy = (busy) => {
    if (submitBtn) submitBtn.disabled = busy;
    if (studentId) studentId.disabled = busy;
    if (password) password.disabled = busy;
    if (togglePassword) togglePassword.disabled = busy;
    if (fillAdmin) fillAdmin.disabled = busy;
    if (fillStudent) fillStudent.disabled = busy;
  };

  const setFieldError = (inputEl, errorEl, message) => {
    if (!inputEl || !errorEl) return;

    if (message) {
      inputEl.style.borderColor = "rgba(239, 68, 68, 0.7)";
      errorEl.textContent = message;
    } else {
      inputEl.style.borderColor = "rgba(231, 236, 255, 0.16)";
      errorEl.textContent = "";
    }
  };

  const validateStudentId = () => {
    const value = (studentId?.value || "").trim();

    if (!value) {
      setFieldError(studentId, studentIdError, "Student ID is required.");
      return false;
    }

    if (value.length < 3) {
      setFieldError(studentId, studentIdError, "Student ID looks too short.");
      return false;
    }

    setFieldError(studentId, studentIdError, "");
    return true;
  };

  const validatePassword = () => {
    const value = password?.value || "";

    if (!value) {
      setFieldError(password, passwordError, "Password is required.");
      return false;
    }

    if (value.length < 6) {
      setFieldError(password, passwordError, "Password must be at least 6 characters.");
      return false;
    }

    setFieldError(password, passwordError, "");
    return true;
  };

  if (togglePassword && password) {
    togglePassword.addEventListener("click", () => {
      const isHidden = password.type === "password";
      password.type = isHidden ? "text" : "password";
      togglePassword.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");

      const icon = togglePassword.querySelector("i");
      if (icon) {
        icon.classList.toggle("bi-eye", !isHidden);
        icon.classList.toggle("bi-eye-slash", isHidden);
      }
    });
  }

  const fill = (user) => {
    if (!studentId || !password) return;

    studentId.value = user.username;
    password.value = user.password;
    validateStudentId();
    validatePassword();
    if (formStatus) formStatus.textContent = "Sample credentials filled. Click Sign in.";
  };

  if (fillAdmin) fillAdmin.addEventListener("click", () => fill(SAMPLE_USERS.admin));
  if (fillStudent) fillStudent.addEventListener("click", () => fill(SAMPLE_USERS.student));

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (formStatus) formStatus.textContent = "";

      const ok = validateStudentId() & validatePassword();
      if (!ok) {
        if (formStatus) formStatus.textContent = "Please fix the highlighted fields.";
        return;
      }

      const inputUser = (studentId?.value || "").trim();
      const inputPass = password?.value || "";

      setBusy(true);
      if (formStatus) formStatus.textContent = "Signing in…";

      try {
        await new Promise((r) => setTimeout(r, 450));

        const isAdmin =
          inputUser === SAMPLE_USERS.admin.username && inputPass === SAMPLE_USERS.admin.password;
        const isStudent =
          inputUser === SAMPLE_USERS.student.username && inputPass === SAMPLE_USERS.student.password;

        if (isAdmin) {
          sessionStorage.setItem("elecom_role", SAMPLE_USERS.admin.role);
          sessionStorage.setItem("elecom_user", SAMPLE_USERS.admin.username);
          window.location.href = SAMPLE_USERS.admin.redirect;
          return;
        }

        if (isStudent) {
          sessionStorage.setItem("elecom_role", SAMPLE_USERS.student.role);
          sessionStorage.setItem("elecom_user", SAMPLE_USERS.student.username);
          window.location.href = SAMPLE_USERS.student.redirect;
          return;
        }

        if (formStatus) formStatus.textContent = "Invalid credentials. Use the sample credentials below.";
        setFieldError(password, passwordError, "Invalid password.");
      } finally {
        setBusy(false);
      }
    });
  }
})();
