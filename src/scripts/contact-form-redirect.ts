document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contact-form") as HTMLFormElement | null;
  const targetFrame = document.getElementById("make-webhook-target") as HTMLIFrameElement | null;

  if (!form || !targetFrame) return;

  const submitBtn = document.getElementById("submit-btn") as HTMLButtonElement | null;
  const btnText = document.getElementById("btn-text") as HTMLSpanElement | null;
  const btnArrow = document.getElementById("btn-arrow") as HTMLSpanElement | null;
  const btnSpinner = document.getElementById("btn-spinner") as HTMLDivElement | null;
  const formMessages = document.getElementById("form-messages") as HTMLDivElement | null;
  const errorMessage = document.getElementById("error-message") as HTMLDivElement | null;

  let pendingSubmit = false;
  let timeoutId: number | null = null;

  form.addEventListener("submit", () => {
    const createdAtField = form.elements.namedItem("created_at") as HTMLInputElement | null;
    const pageField = form.elements.namedItem("page") as HTMLInputElement | null;

    if (createdAtField) createdAtField.value = new Date().toISOString();
    if (pageField) pageField.value = window.location.href;

    pendingSubmit = true;

    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.textContent = "Enviando...";
    if (btnArrow) btnArrow.classList.add("hidden");
    if (btnSpinner) btnSpinner.classList.remove("hidden");

    if (formMessages) formMessages.classList.add("hidden");
    if (errorMessage) errorMessage.classList.add("hidden");

    if (timeoutId) window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      if (!pendingSubmit) return;

      pendingSubmit = false;

      if (submitBtn) submitBtn.disabled = false;
      if (btnText) btnText.textContent = "Enviar consulta";
      if (btnArrow) btnArrow.classList.remove("hidden");
      if (btnSpinner) btnSpinner.classList.add("hidden");

      if (formMessages) formMessages.classList.remove("hidden");
      if (errorMessage) errorMessage.classList.remove("hidden");
    }, 12000);
  });

  const goToSuccess = () => {
    const successUrlField = form.elements.namedItem("success_url") as HTMLInputElement | null;
    const successUrl = successUrlField?.value || "/contacto/enviado";
    window.location.assign(successUrl);
  };

  targetFrame.addEventListener("load", () => {
    if (!pendingSubmit) return;
    pendingSubmit = false;
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
    goToSuccess();
  });
});
