type MugaDataLayerEntry = Record<string, unknown>;

type MugaAnalyticsWindow = Window &
  typeof globalThis & {
    dataLayer?: MugaDataLayerEntry[];
    __mugaAnalyticsBound?: boolean;
    __mugaLastTrackedPath?: string;
    __mugaSessionStarted?: boolean;
  };

const mugaAnalyticsWindow = window as MugaAnalyticsWindow;
const SESSION_STORAGE_KEY = "muga_analytics_session_id";
const COLLECT_ENDPOINT = "/api/analytics/collect";
const ANALYTICS_CONSENT_KEY = "muga_analytics_consent";

const hasAnalyticsConsent = () => {
  try {
    return window.localStorage.getItem(ANALYTICS_CONSENT_KEY) === "granted";
  } catch {
    return false;
  }
};

const randomToken = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `muga-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const getSessionId = () => {
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const next = randomToken();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return randomToken();
  }
};

const getUtmFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
  };
};

const sendToCollector = (detail: MugaDataLayerEntry) => {
  try {
    const payload = JSON.stringify(detail);
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      const queued = navigator.sendBeacon(COLLECT_ENDPOINT, blob);
      if (queued) return;
    }

    fetch(COLLECT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Never break UX due to analytics transport errors.
    });
  } catch {
    // Ignore client-side serialization/transport errors.
  }
};

const buildEventDetail = (
  eventName: string,
  payload: Record<string, unknown> = {},
): MugaDataLayerEntry => {
  const url = new URL(window.location.href);
  const utm = getUtmFromUrl();

  return {
    event: eventName,
    session_id: getSessionId(),
    page_path: window.location.pathname,
    page_url: url.toString(),
    referrer: document.referrer || "",
    ...utm,
    timestamp: new Date().toISOString(),
    ...payload,
  };
};

const emitTrackingEvent = (
  eventName: string,
  payload: Record<string, unknown> = {},
) => {
  if (!hasAnalyticsConsent()) return;

  const detail = buildEventDetail(eventName, payload);

  if (Array.isArray(mugaAnalyticsWindow.dataLayer)) {
    mugaAnalyticsWindow.dataLayer.push(detail);
  }

  sendToCollector(detail);

  document.dispatchEvent(
    new CustomEvent("muga:track", {
      detail,
    }),
  );
};

const getFunnelStep = (path: string) => {
  if (path === "/") return "home";
  if (path === "/contacto") return "contacto";
  if (path === "/contacto/enviado") return "contacto_enviado";
  return null;
};

const trackPageView = () => {
  if (!hasAnalyticsConsent()) return;
  if (mugaAnalyticsWindow.__mugaLastTrackedPath === window.location.pathname) return;

  const funnelStep = getFunnelStep(window.location.pathname);

  if (!mugaAnalyticsWindow.__mugaSessionStarted) {
    emitTrackingEvent("session_start");
    mugaAnalyticsWindow.__mugaSessionStarted = true;
  }

  emitTrackingEvent("page_view");

  if (funnelStep) {
    emitTrackingEvent("funnel_step_view", {
      funnel_step: funnelStep,
    });
  }

  mugaAnalyticsWindow.__mugaLastTrackedPath = window.location.pathname;
};

const handleTrackedClick = (event: MouseEvent) => {
  const target = event.target as Element | null;
  const trackedElement = target?.closest<HTMLElement>("[data-analytics-event]");

  if (!trackedElement) return;

  const {
    analyticsEvent,
    analyticsLabel,
    analyticsLocation,
    analyticsDestination,
    analyticsStep,
  } = trackedElement.dataset;

  if (!analyticsEvent) return;

  emitTrackingEvent(analyticsEvent, {
    label: analyticsLabel || trackedElement.textContent?.trim() || "unknown",
    location: analyticsLocation || "unspecified",
    destination: analyticsDestination || trackedElement.getAttribute("href") || "",
    funnel_step: analyticsStep || getFunnelStep(window.location.pathname) || "unspecified",
  });
};

const handleTrackedSelect = (event: Event) => {
  const field = event.target as HTMLSelectElement | null;

  if (!field?.matches("[data-analytics-select]")) return;

  emitTrackingEvent("form_field_selected", {
    field_name: field.name,
    field_value: field.value || "empty",
    form_id: field.form?.id || "unknown",
    form_context: field.dataset.analyticsContext || "unspecified",
  });
};

const handleFormState = (event: Event) => {
  const customEvent = event as CustomEvent<Record<string, unknown>>;
  const detail = customEvent.detail || {};
  const formEvent = typeof detail.event === "string" ? detail.event : null;

  if (!formEvent) return;

  const payload = { ...detail };
  delete payload.event;

  emitTrackingEvent(formEvent, payload);
};

const initAnalytics = () => {
  if (!hasAnalyticsConsent()) return;
  trackPageView();
};

const handleConsentGranted = () => {
  mugaAnalyticsWindow.__mugaSessionStarted = false;
  mugaAnalyticsWindow.__mugaLastTrackedPath = "";
  initAnalytics();
};

if (!mugaAnalyticsWindow.__mugaAnalyticsBound) {
  document.addEventListener("click", handleTrackedClick, { passive: true });
  document.addEventListener("change", handleTrackedSelect, { passive: true });
  document.addEventListener("muga:form-state", handleFormState as EventListener);
  document.addEventListener("DOMContentLoaded", initAnalytics);
  document.addEventListener("astro:page-load", initAnalytics);
  window.addEventListener("muga:analytics-consent-granted", handleConsentGranted);
  mugaAnalyticsWindow.__mugaAnalyticsBound = true;
}

initAnalytics();
