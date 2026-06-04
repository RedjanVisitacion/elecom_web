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
  const rememberMe = $("rememberMe");
  const agreeTerms = $("agreeTerms");
  const termsLink = $("termsLink");
  const forgotPassword = $("forgotPassword");
  const forgotModal = $("forgotModal");
  const forgotClose = $("forgotClose");
  const forgotIdentifier = $("forgotIdentifier");
  const forgotOtp = $("forgotOtp");
  const forgotOtpHint = $("forgotOtpHint");
  const forgotNewPassword = $("forgotNewPassword");
  const forgotConfirmPassword = $("forgotConfirmPassword");
  const forgotTogglePassword = $("forgotTogglePassword");
  const forgotSendOtp = $("forgotSendOtp");
  const forgotVerifyOtp = $("forgotVerifyOtp");
  const forgotResetPassword = $("forgotResetPassword");
  const forgotResendOtp = $("forgotResendOtp");
  const forgotStatus = $("forgotStatus");
  const TERMS_URL = "/terms-and-conditions/?from=login";
  const TERMS_DRAFT_KEY = "elecom_login_terms_draft";

  if (year) year.textContent = String(new Date().getFullYear());

  const saveTermsDraft = () => {
    try {
      sessionStorage.setItem(
        TERMS_DRAFT_KEY,
        JSON.stringify({
          studentId: studentId ? studentId.value : "",
          password: password ? password.value : "",
          rememberMe: rememberMe ? rememberMe.checked : false,
        }),
      );
    } catch {}
  };

  const restoreTermsDraft = () => {
    try {
      const raw = sessionStorage.getItem(TERMS_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (studentId) studentId.value = draft.studentId || "";
      if (password) password.value = draft.password || "";
      if (rememberMe) rememberMe.checked = !!draft.rememberMe;
      sessionStorage.removeItem(TERMS_DRAFT_KEY);
    } catch {}
  };

  if (studentId) studentId.value = "";
  if (password) password.value = "";

  try {
    const remembered = localStorage.getItem("elecom_remember_student_id");
    if (rememberMe && studentId && remembered) {
      rememberMe.checked = true;
      studentId.value = remembered;
    }
  } catch {}

  try {
    const params = new URLSearchParams(window.location.search || "");
    const termsDecision = params.get("terms");
    if (agreeTerms && (termsDecision === "accepted" || termsDecision === "declined")) {
      restoreTermsDraft();
      agreeTerms.checked = termsDecision === "accepted";
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  } catch {}

  const API_BASE =
    (form && form.dataset && form.dataset.apiBase) ||
    (typeof window !== "undefined" && window.location && window.location.origin) ||
    "http://127.0.0.1:8000";
  const FORGOT_BASE = `${API_BASE}/api/mobile/auth`;

  let forgotResetToken = "";
  let forgotActiveIdentifier = "";

  const setForgotStatus = (message, type = "") => {
    if (!forgotStatus) return;
    forgotStatus.textContent = message || "";
    forgotStatus.classList.toggle("is-error", type === "error");
    forgotStatus.classList.toggle("is-success", type === "success");
  };

  const setForgotBusy = (busy) => {
    [forgotSendOtp, forgotVerifyOtp, forgotResetPassword, forgotResendOtp, forgotClose].forEach((btn) => {
      if (btn) btn.disabled = !!busy;
    });
    [forgotIdentifier, forgotOtp, forgotNewPassword, forgotConfirmPassword, forgotTogglePassword].forEach((input) => {
      if (input) input.disabled = !!busy;
    });
    [forgotSendOtp, forgotVerifyOtp, forgotResetPassword].forEach((btn) => {
      if (btn) {
        btn.classList.toggle("is-loading", !!busy);
        btn.setAttribute("aria-busy", busy ? "true" : "false");
      }
    });
  };

  const showForgotStep = (name) => {
    if (!forgotModal) return;
    forgotModal.querySelectorAll(".forgot-step").forEach((step) => {
      step.classList.toggle("is-active", step.dataset.step === name);
    });
  };

  const openForgotModal = () => {
    if (!forgotModal) return;
    forgotResetToken = "";
    forgotActiveIdentifier = (studentId?.value || "").trim();
    if (forgotIdentifier) forgotIdentifier.value = forgotActiveIdentifier;
    if (forgotOtp) forgotOtp.value = "";
    if (forgotNewPassword) forgotNewPassword.value = "";
    if (forgotConfirmPassword) forgotConfirmPassword.value = "";
    showForgotStep("request");
    setForgotStatus("");
    forgotModal.classList.add("is-open");
    forgotModal.setAttribute("aria-hidden", "false");
    setTimeout(() => (forgotIdentifier?.value ? forgotSendOtp?.focus() : forgotIdentifier?.focus()), 40);
  };

  const closeForgotModal = () => {
    if (!forgotModal) return;
    forgotModal.classList.remove("is-open");
    forgotModal.setAttribute("aria-hidden", "true");
    setForgotBusy(false);
  };

  const forgotPost = async (path, body) => {
    const res = await fetch(`${FORGOT_BASE}/${path}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok !== true) {
      throw new Error(data.error || data.detail || "Something went wrong. Please try again.");
    }
    return data;
  };

  const requestForgotOtp = async () => {
    const identifier = (forgotIdentifier?.value || "").trim();
    if (!identifier) {
      setForgotStatus("Enter your Student ID or registered email.", "error");
      forgotIdentifier?.focus();
      return;
    }

    setForgotBusy(true);
    setForgotStatus("Sending OTP...");
    try {
      const data = await forgotPost("forgot-password", { identifier });
      forgotActiveIdentifier = identifier;
      const masked = data.masked_email ? ` sent to ${data.masked_email}` : " sent to your registered email";
      if (forgotOtpHint) forgotOtpHint.textContent = `Enter the 6-digit code${masked}.`;
      showForgotStep("verify");
      setForgotStatus(`OTP${masked}.`, "success");
      setTimeout(() => forgotOtp?.focus(), 40);
    } catch (err) {
      setForgotStatus(err.message || "Failed to send OTP.", "error");
    } finally {
      setForgotBusy(false);
    }
  };

  const verifyForgotOtp = async () => {
    const otp = (forgotOtp?.value || "").trim();
    if (!/^\d{6}$/.test(otp)) {
      setForgotStatus("Enter the 6-digit OTP code.", "error");
      forgotOtp?.focus();
      return;
    }

    setForgotBusy(true);
    setForgotStatus("Verifying OTP...");
    try {
      const data = await forgotPost("verify-otp", {
        identifier: forgotActiveIdentifier,
        otp,
      });
      forgotResetToken = data.reset_token || "";
      showForgotStep("reset");
      setForgotStatus("OTP verified. Create your new password.", "success");
      setTimeout(() => forgotNewPassword?.focus(), 40);
    } catch (err) {
      setForgotStatus(err.message || "Invalid OTP code.", "error");
      if (forgotOtp) forgotOtp.value = "";
      forgotOtp?.focus();
    } finally {
      setForgotBusy(false);
    }
  };

  const resetForgotPassword = async () => {
    const newPass = forgotNewPassword?.value || "";
    const confirmPass = forgotConfirmPassword?.value || "";
    if (newPass.length < 6) {
      setForgotStatus("Password must be at least 6 characters.", "error");
      forgotNewPassword?.focus();
      return;
    }
    if (newPass !== confirmPass) {
      setForgotStatus("Passwords do not match.", "error");
      forgotConfirmPassword?.focus();
      return;
    }
    if (!forgotResetToken) {
      setForgotStatus("Reset session expired. Please request a new OTP.", "error");
      showForgotStep("request");
      return;
    }

    setForgotBusy(true);
    setForgotStatus("Saving new password...");
    try {
      await forgotPost("reset-password", {
        reset_token: forgotResetToken,
        new_password: newPass,
      });
      setForgotStatus("Password reset successfully. You can now sign in.", "success");
      if (studentId && forgotActiveIdentifier && !forgotActiveIdentifier.includes("@")) {
        studentId.value = forgotActiveIdentifier;
      }
      if (password) {
        password.value = "";
        password.focus();
      }
      setTimeout(closeForgotModal, 1100);
    } catch (err) {
      setForgotStatus(err.message || "Failed to reset password.", "error");
    } finally {
      setForgotBusy(false);
    }
  };

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

    if (submitBtn) {
      submitBtn.classList.toggle("is-loading", !!busy);
      submitBtn.setAttribute("aria-busy", busy ? "true" : "false");
    }
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

  if (forgotTogglePassword && forgotNewPassword) {
    forgotTogglePassword.addEventListener("click", () => {
      const isHidden = forgotNewPassword.type === "password";
      forgotNewPassword.type = isHidden ? "text" : "password";
      forgotTogglePassword.setAttribute("aria-label", isHidden ? "Hide new password" : "Show new password");

      const icon = forgotTogglePassword.querySelector("i");
      if (icon) {
        icon.classList.toggle("bi-eye", !isHidden);
        icon.classList.toggle("bi-eye-slash", isHidden);
      }
    });
  }

  if (forgotPassword) {
    forgotPassword.addEventListener("click", (event) => {
      event.preventDefault();
      openForgotModal();
    });
  }

  if (forgotClose) forgotClose.addEventListener("click", closeForgotModal);
  if (forgotModal) {
    forgotModal.addEventListener("click", (event) => {
      if (event.target && event.target.closest("[data-forgot-close]")) closeForgotModal();
    });
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && forgotModal?.classList.contains("is-open")) {
      closeForgotModal();
    }
  });
  if (forgotSendOtp) forgotSendOtp.addEventListener("click", requestForgotOtp);
  if (forgotResendOtp) forgotResendOtp.addEventListener("click", requestForgotOtp);
  if (forgotVerifyOtp) forgotVerifyOtp.addEventListener("click", verifyForgotOtp);
  if (forgotResetPassword) forgotResetPassword.addEventListener("click", resetForgotPassword);
  [forgotIdentifier, forgotOtp, forgotNewPassword, forgotConfirmPassword].forEach((input) => {
    if (!input) return;
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (input === forgotIdentifier) requestForgotOtp();
      else if (input === forgotOtp) verifyForgotOtp();
      else resetForgotPassword();
    });
  });

  if (forgotOtp) {
    forgotOtp.addEventListener("input", () => {
      forgotOtp.value = forgotOtp.value.replace(/\D/g, "").slice(0, 6);
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

  if (termsLink) {
    termsLink.addEventListener("click", () => {
      try {
        saveTermsDraft();
      } catch {}
    });
  }

  if (agreeTerms) {
    agreeTerms.addEventListener("click", (event) => {
      if (agreeTerms.checked) {
        event.preventDefault();
        try {
          saveTermsDraft();
        } catch {}
        window.location.href = TERMS_URL;
      }
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      const isDjangoAuth = form.dataset.auth === "django";

      if (!isDjangoAuth) e.preventDefault();
      if (formStatus) formStatus.textContent = "";

      if (agreeTerms && !agreeTerms.checked) {
        e.preventDefault();
        if (formStatus) formStatus.textContent = "Please confirm the Terms & Conditions.";
        return;
      }

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

      try {
        if (rememberMe && rememberMe.checked) {
          localStorage.setItem("elecom_remember_student_id", inputUser);
        } else {
          localStorage.removeItem("elecom_remember_student_id");
        }
      } catch {}

      setBusy(true);
      if (formStatus) formStatus.textContent = "Signing in…";

      try {
        const res = await fetch(`${API_BASE}/login/`, {
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
        sessionStorage.setItem("elecom_user", data.student_id || inputUser);

        const isHttp = typeof window !== "undefined" && window.location && window.location.protocol !== "file:";
        const staticBase = isHttp ? `${API_BASE}/static/org_elecom` : ".";
        let redirectUrl =
          data.role === "admin"
            ? `${staticBase}/elecom_admin/admin_dashboard.html`
            : `${staticBase}/elecom_user/user_dashboard.html`;

        if (data.role === "admin" && isHttp) {
          try {
            const tokenUrl = new URL(`${API_BASE}/api/admin/page-token/`);
            tokenUrl.searchParams.set("page", "admin_dashboard.html");
            const tokenRes = await fetch(tokenUrl.toString(), {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            });
            const tokenData = await tokenRes.json().catch(() => ({}));
            if (tokenRes.ok && tokenData.ok && tokenData.secure_url) {
              redirectUrl = `${API_BASE}${tokenData.secure_url}`;
            }
          } catch {
            // Fall back to the dashboard; it will bootstrap the secure route.
          }
        }
        window.location.href = redirectUrl;
      } catch {
        if (formStatus) formStatus.textContent = "Cannot connect to server. Make sure Django is running.";
      } finally {
        setBusy(false);
      }
    });
  }
})();
