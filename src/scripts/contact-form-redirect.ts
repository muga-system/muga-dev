type MugaContactWindow = Window &
  typeof globalThis & {
    __mugaContactFormRedirectBound?: boolean;
  };

const getFormContext = () => {
  if (window.location.pathname === "/") return "home";
  if (window.location.pathname.startsWith("/contacto")) return "contacto";
  return "unknown";
};

const emitFormTrackingEvent = (
  eventName: string,
  payload: Record<string, string> = {},
) => {
  document.dispatchEvent(
    new CustomEvent("muga:form-state", {
      detail: {
        event: eventName,
        form_id: "contact-form",
        form_context: getFormContext(),
        ...payload,
      },
    }),
  );
};

const initContactFormRedirect = () => {
  const form = document.getElementById("contact-form") as HTMLFormElement | null;
  const targetFrame = document.getElementById("make-webhook-target") as HTMLIFrameElement | null;

  if (!form || !targetFrame) return;
  if (form.dataset.bound === "true") return;
  form.dataset.bound = "true";

  const submitBtn = document.getElementById("submit-btn") as HTMLButtonElement | null;
  const btnText = document.getElementById("btn-text") as HTMLSpanElement | null;
  const btnArrow = document.getElementById("btn-arrow") as HTMLSpanElement | null;
  const btnSpinner = document.getElementById("btn-spinner") as HTMLDivElement | null;
  const formMessages = document.getElementById("form-messages") as HTMLDivElement | null;
  const successMessage = document.getElementById("success-message") as HTMLDivElement | null;
  const errorMessage = document.getElementById("error-message") as HTMLDivElement | null;
  const defaultButtonText = btnText?.textContent || "Enviar";

  let pendingSubmit = false;
  let hasUnsavedChanges = false;
  let timeoutId: number | null = null;

  const markAsDirty = () => {
    hasUnsavedChanges = true;
  };

  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!hasUnsavedChanges || pendingSubmit) return;

    event.preventDefault();
    event.returnValue = "";
  };

  form.addEventListener("input", markAsDirty, { passive: true });
  form.addEventListener("change", markAsDirty, { passive: true });
  window.addEventListener("beforeunload", handleBeforeUnload);

  const updateLeadSegmentation = () => {
    const projectField = form.elements.namedItem("project") as HTMLSelectElement | null;
    const budgetField = form.elements.namedItem("budget") as HTMLSelectElement | null;
    const leadTierField = form.elements.namedItem("lead_tier") as HTMLInputElement | null;
    const leadStageField = form.elements.namedItem("lead_stage") as HTMLInputElement | null;
    const leadRouteField = form.elements.namedItem("lead_route") as HTMLInputElement | null;

    const budgetValue = budgetField?.value || "";
    const projectValue = projectField?.value || "";

    const leadTier = budgetValue || "undecided";
    const leadStage =
      budgetValue === "premium"
        ? "high-intent"
        : budgetValue === "business"
          ? "qualified"
          : budgetValue === "start"
            ? "entry"
            : "discovery";
    const leadRoute = `${projectValue || "unspecified"}:${budgetValue || "undecided"}`;

    if (leadTierField) leadTierField.value = leadTier;
    if (leadStageField) leadStageField.value = leadStage;
    if (leadRouteField) leadRouteField.value = leadRoute;
  };

  form.addEventListener("submit", () => {
    const createdAtField = form.elements.namedItem("created_at") as HTMLInputElement | null;
    const pageField = form.elements.namedItem("page") as HTMLInputElement | null;

    if (createdAtField) createdAtField.value = new Date().toISOString();
    if (pageField) pageField.value = window.location.href;
    updateLeadSegmentation();

    const projectField = form.elements.namedItem("project") as HTMLSelectElement | null;
    const budgetField = form.elements.namedItem("budget") as HTMLSelectElement | null;

    emitFormTrackingEvent("form_submit_started", {
      project: projectField?.value || "empty",
      budget: budgetField?.value || "empty",
    });

    pendingSubmit = true;

    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.textContent = "Enviando…";
    if (btnArrow) btnArrow.classList.add("hidden");
    if (btnSpinner) btnSpinner.classList.remove("hidden");

    if (formMessages) formMessages.classList.add("hidden");
    if (successMessage) successMessage.classList.add("hidden");
    if (errorMessage) errorMessage.classList.add("hidden");

    if (timeoutId) window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      if (!pendingSubmit) return;

      pendingSubmit = false;

      if (submitBtn) submitBtn.disabled = false;
      if (btnText) btnText.textContent = defaultButtonText;
      if (btnArrow) btnArrow.classList.remove("hidden");
      if (btnSpinner) btnSpinner.classList.add("hidden");

      if (formMessages) formMessages.classList.remove("hidden");
      if (errorMessage) errorMessage.classList.remove("hidden");

      emitFormTrackingEvent("form_submit_error", {
        error_type: "timeout",
      });
    }, 12000);
  });

  targetFrame.addEventListener("load", () => {
    if (!pendingSubmit) return;
    pendingSubmit = false;
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (submitBtn) submitBtn.disabled = false;
    if (btnText) btnText.textContent = defaultButtonText;
    if (btnArrow) btnArrow.classList.remove("hidden");
    if (btnSpinner) btnSpinner.classList.add("hidden");

    form.reset();
    hasUnsavedChanges = false;

    if (formMessages) formMessages.classList.remove("hidden");
    if (successMessage) successMessage.classList.remove("hidden");

    emitFormTrackingEvent("form_submit_success");
  });
};

const mugaContactWindow = window as MugaContactWindow;

if (!mugaContactWindow.__mugaContactFormRedirectBound) {
  document.addEventListener("DOMContentLoaded", initContactFormRedirect);
  document.addEventListener("astro:page-load", initContactFormRedirect);
  mugaContactWindow.__mugaContactFormRedirectBound = true;
}

initContactFormRedirect();
