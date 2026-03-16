type MugaContactWindow = Window &
  typeof globalThis & {
    __mugaContactFormRedirectBound?: boolean;
  };

const getFormContext = () => {
  if (window.location.pathname === "/") return "home";
  if (window.location.pathname.startsWith("/contacto")) return "contacto";
  return "unknown";
};

const getQueryValue = (name: string) => {
  return new URLSearchParams(window.location.search).get(name) || "";
};

const ATTRIBUTION_STORAGE_KEY = "muga_attribution_v1";

type AttributionSnapshot = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
  landing_page?: string;
  captured_at?: string;
};

type AttributionStore = {
  firstTouch?: AttributionSnapshot;
  lastTouch?: AttributionSnapshot;
};

const safeLower = (value: string) => String(value || "").trim().toLowerCase();

const readAttributionStore = (): AttributionStore => {
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AttributionStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeAttributionStore = (store: AttributionStore) => {
  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage write errors.
  }
};

const buildCurrentAttribution = (): AttributionSnapshot => {
  const snapshot: AttributionSnapshot = {
    utm_source: getQueryValue("utm_source"),
    utm_medium: getQueryValue("utm_medium"),
    utm_campaign: getQueryValue("utm_campaign"),
    utm_term: getQueryValue("utm_term"),
    utm_content: getQueryValue("utm_content"),
    gclid: getQueryValue("gclid"),
    fbclid: getQueryValue("fbclid"),
    landing_page: window.location.pathname,
    captured_at: new Date().toISOString(),
  };

  const hasUtmData =
    !!snapshot.utm_source ||
    !!snapshot.utm_medium ||
    !!snapshot.utm_campaign ||
    !!snapshot.utm_term ||
    !!snapshot.utm_content ||
    !!snapshot.gclid ||
    !!snapshot.fbclid;

  return hasUtmData ? snapshot : {};
};

const inferFallbackAttribution = () => {
  const gclid = getQueryValue("gclid");
  const fbclid = getQueryValue("fbclid");

  if (gclid) {
    return { utm_source: "google", utm_medium: "cpc", gclid };
  }

  if (fbclid) {
    return { utm_source: "facebook", utm_medium: "cpc", fbclid };
  }

  const referrer = document.referrer || "";
  if (!referrer) return { utm_source: "direct", utm_medium: "none" };

  try {
    const referrerHost = new URL(referrer).hostname;
    const currentHost = window.location.hostname;
    if (!referrerHost || referrerHost === currentHost) {
      return { utm_source: "direct", utm_medium: "none" };
    }
    return { utm_source: safeLower(referrerHost), utm_medium: "referral" };
  } catch {
    return { utm_source: "direct", utm_medium: "none" };
  }
};

const resolveAttributionValues = () => {
  const store = readAttributionStore();
  const current = buildCurrentAttribution();
  const hasCurrentData = Object.keys(current).length > 0;

  if (hasCurrentData) {
    const nextStore: AttributionStore = {
      firstTouch: store.firstTouch || current,
      lastTouch: current,
    };
    writeAttributionStore(nextStore);
    return {
      ...inferFallbackAttribution(),
      ...nextStore.firstTouch,
      ...nextStore.lastTouch,
    };
  }

  const merged = {
    ...inferFallbackAttribution(),
    ...(store.firstTouch || {}),
    ...(store.lastTouch || {}),
  };

  return merged;
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

  if (!form) return;
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
  let sendingDotsIntervalId: number | null = null;

  const markAsDirty = () => {
    hasUnsavedChanges = true;
  };

  const startSendingDots = () => {
    if (!btnText) return;
    let frame = 0;
    const frames = ["Enviando consulta", "Enviando consulta.", "Enviando consulta..", "Enviando consulta..."];

    btnText.textContent = frames[0];
    sendingDotsIntervalId = window.setInterval(() => {
      frame = (frame + 1) % frames.length;
      btnText.textContent = frames[frame];
    }, 280);
  };

  const stopSendingDots = () => {
    if (sendingDotsIntervalId !== null) {
      window.clearInterval(sendingDotsIntervalId);
      sendingDotsIntervalId = null;
    }
    if (btnText) btnText.textContent = defaultButtonText;
  };

  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!hasUnsavedChanges || pendingSubmit) return;

    event.preventDefault();
    event.returnValue = "";
  };

  const clearNavigationGuard = () => {
    hasUnsavedChanges = false;
    pendingSubmit = true;
    window.removeEventListener("beforeunload", handleBeforeUnload);
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

  const updateAttributionFields = () => {
    const pageField = form.elements.namedItem("page") as HTMLInputElement | null;
    const landingPageField = form.elements.namedItem("landing_page") as HTMLInputElement | null;
    const referrerField = form.elements.namedItem("referrer") as HTMLInputElement | null;
    const localeField = form.elements.namedItem("locale") as HTMLInputElement | null;
    const timezoneField = form.elements.namedItem("timezone") as HTMLInputElement | null;
    const userAgentField = form.elements.namedItem("user_agent") as HTMLInputElement | null;

    const utmSourceField = form.elements.namedItem("utm_source") as HTMLInputElement | null;
    const utmMediumField = form.elements.namedItem("utm_medium") as HTMLInputElement | null;
    const utmCampaignField = form.elements.namedItem("utm_campaign") as HTMLInputElement | null;
    const utmTermField = form.elements.namedItem("utm_term") as HTMLInputElement | null;
    const utmContentField = form.elements.namedItem("utm_content") as HTMLInputElement | null;
    const gclidField = form.elements.namedItem("gclid") as HTMLInputElement | null;
    const fbclidField = form.elements.namedItem("fbclid") as HTMLInputElement | null;

    if (pageField) pageField.value = window.location.href;
    if (landingPageField) landingPageField.value = window.location.pathname;
    if (referrerField) referrerField.value = document.referrer || "direct";
    if (localeField) localeField.value = navigator.language || "unknown";
    if (timezoneField) timezoneField.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
    if (userAgentField) userAgentField.value = navigator.userAgent || "unknown";

    const attribution = resolveAttributionValues();

    if (utmSourceField) utmSourceField.value = String(attribution.utm_source || "");
    if (utmMediumField) utmMediumField.value = String(attribution.utm_medium || "");
    if (utmCampaignField) utmCampaignField.value = String(attribution.utm_campaign || "");
    if (utmTermField) utmTermField.value = String(attribution.utm_term || "");
    if (utmContentField) utmContentField.value = String(attribution.utm_content || "");
    if (gclidField) gclidField.value = String(attribution.gclid || "");
    if (fbclidField) fbclidField.value = String(attribution.fbclid || "");
  };

  updateAttributionFields();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const createdAtField = form.elements.namedItem("created_at") as HTMLInputElement | null;

    if (createdAtField) createdAtField.value = new Date().toISOString();
    updateAttributionFields();
    updateLeadSegmentation();

    const projectField = form.elements.namedItem("project") as HTMLSelectElement | null;
    const budgetField = form.elements.namedItem("budget") as HTMLSelectElement | null;

    emitFormTrackingEvent("form_submit_started", {
      project: projectField?.value || "empty",
      budget: budgetField?.value || "empty",
    });

    pendingSubmit = true;

    if (submitBtn) submitBtn.disabled = true;
    if (submitBtn) submitBtn.setAttribute("aria-busy", "true");
    startSendingDots();
    if (btnArrow) btnArrow.classList.add("hidden");
    if (btnSpinner) btnSpinner.classList.remove("hidden");

    if (submitBtn) {
      // Force a repaint so loading state is visible before network request.
      submitBtn.offsetHeight;
    }

    if (formMessages) formMessages.classList.add("hidden");
    if (successMessage) successMessage.classList.add("hidden");
    if (errorMessage) errorMessage.classList.add("hidden");

    const formData = new FormData(form);
    const payload: Record<string, string> = {};

    formData.forEach((value, key) => {
      if (typeof value === "string") payload[key] = value;
    });

    const abortController = new AbortController();

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    if (timeoutId) window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      abortController.abort();
    }, 12000);

    try {
      const response = await fetch("/api/contacto", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Supabase request failed: ${response.status}`);
      }

      clearNavigationGuard();
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (submitBtn) submitBtn.disabled = true;
      if (submitBtn) submitBtn.setAttribute("aria-busy", "true");
      emitFormTrackingEvent("form_submit_success");

      await new Promise((resolve) => window.setTimeout(resolve, 700));

      window.location.assign("/contacto/enviado");
    } catch {
      pendingSubmit = false;

      if (submitBtn) submitBtn.disabled = false;
      if (submitBtn) submitBtn.setAttribute("aria-busy", "false");
      stopSendingDots();
      if (btnArrow) btnArrow.classList.remove("hidden");
      if (btnSpinner) btnSpinner.classList.add("hidden");

      if (formMessages) formMessages.classList.remove("hidden");
      if (errorMessage) errorMessage.classList.remove("hidden");

      emitFormTrackingEvent("form_submit_error", {
        error_type: abortController.signal.aborted ? "timeout" : "network",
      });

      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
  });
};

const mugaContactWindow = window as MugaContactWindow;

if (!mugaContactWindow.__mugaContactFormRedirectBound) {
  document.addEventListener("DOMContentLoaded", initContactFormRedirect);
  document.addEventListener("astro:page-load", initContactFormRedirect);
  mugaContactWindow.__mugaContactFormRedirectBound = true;
}

initContactFormRedirect();
