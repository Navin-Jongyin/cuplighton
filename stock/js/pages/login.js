import { login } from "../auth.js";
import { go } from "../router.js";

export function render(root) {
  root.innerHTML = `
    <div class="login-split">
      <div class="login-box">
        <a class="brand" href="#/login">
          <img src="assets/logo.png" alt="cuplighton" class="brand-logo">
        </a>
        <h2>Login</h2>
        <form id="login-form">
          <div class="field" id="pin-field">
            <label>User code</label>
            <input
              class="scan-input pin-input"
              name="pin"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              pattern="[0-9]{6}"
              maxlength="6"
              minlength="6"
              required
              placeholder="000000"
              aria-label="6-digit user code"
              aria-describedby="pin-error"
            >
            <p class="pin-error" id="pin-error" hidden></p>
          </div>
          <button class="btn btn-primary btn-block btn-lg" type="submit">Sign in</button>
        </form>
        <p class="login-hint">Enter your 6-digit staff code</p>
      </div>
    </div>
  `;
  const form = root.querySelector("#login-form");
  const field = form.querySelector("#pin-field");
  const input = form.querySelector("[name=pin]");
  const errorEl = form.querySelector("#pin-error");
  const showError = (message) => {
    field.classList.add("field-error");
    errorEl.hidden = false;
    errorEl.textContent = message;
    input.select();
  };
  const clearError = () => {
    field.classList.remove("field-error");
    errorEl.hidden = true;
    errorEl.textContent = "";
  };
  const submit = () => {
    const res = login(input.value);
    if (!res.ok) { showError(res.error); return; }
    clearError();
    go("/dashboard");
  };
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 6);
    clearError();
    if (input.value.length === 6) submit();
  });
  form.onsubmit = (e) => {
    e.preventDefault();
    submit();
  };
  input.focus();
}
