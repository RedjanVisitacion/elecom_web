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

  const API_BASE = (form && form.dataset && form.dataset.apiBase) || "http://127.0.0.1:8000";

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
      const isDjangoAuth = form.dataset.auth === "django";

      if (!isDjangoAuth) e.preventDefault();
      if (formStatus) formStatus.textContent = "";

      const ok = validateStudentId() & validatePassword();
      if (!ok) {
        e.preventDefault();
        if (formStatus) formStatus.textContent = "Please fix the highlighted fields.";
        return;
      }

      if (isDjangoAuth) {
        return;
      }

      const inputUser = (studentId?.value || "").trim();
      const inputPass = password?.value || "";

      setBusy(true);
      if (formStatus) formStatus.textContent = "Signing in…";

      try {
        const res = await fetch(`${API_BASE}/api/login/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ studentId: inputUser, password: inputPass }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          const msg = data.error || "Invalid credentials.";
          if (formStatus) formStatus.textContent = msg;
          setFieldError(password, passwordError, msg);
          return;
        }

        sessionStorage.setItem("elecom_role", data.role || "user");
        sessionStorage.setItem("elecom_user", data.username || inputUser);

        const redirectUrl =
          data.role === "admin" ? "./elecom_admin/admin_dashboard.html" : "./elecom_user/user_dashboard.html";
        window.location.href = redirectUrl;
      } catch {
        if (formStatus) formStatus.textContent = "Cannot connect to server. Make sure Django is running.";
      } finally {
        setBusy(false);
      }
    });
  }
})();
