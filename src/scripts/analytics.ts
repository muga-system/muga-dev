type MugaDataLayerEntry = Record<string, unknown>;

type MugaGoatCounterPayload = {
  event?: boolean;
  path?: string;
  referrer?: string;
  title?: string;
};

type MugaGoatCounter = {
  allow_local?: boolean;
  count?: (payload?: MugaGoatCounterPayload) => void;
  endpoint?: string;
  no_events?: boolean;
  no_onload?: boolean;
};

type MugaAnalyticsWindow = Window &
  typeof globalThis & {
    dataLayer?: MugaDataLayerEntry[];
    __mugaAnalyticsBound?: boolean;
    __mugaGoatCounterFlushBound?: boolean;
    __mugaLastTrackedPath?: string;
    __mugaPendingGoatCounter?: MugaGoatCounterPayload[];
    goatcounter?: MugaGoatCounter;
  };

const mugaAnalyticsWindow = window as MugaAnalyticsWindow;

const goatCounterEventMap: Record<string, string> = {
  cta_click: "cta-click",
  nav_click: "navigation-click",
  content_navigation_click: "content-link-click",
  footer_cta_click: "cta-click",
  footer_link_click: "footer-link-click",
  post_submit_navigation_click: "post-submit-click",
  form_field_selected: "form-field-selected",
  form_submit_started: "form-started",
  form_submit_success: "form-submitted",
  form_submit_error: "form-submit-error",
};

const buildEventDetail = (
  eventName: string,
  payload: Record<string, unknown> = {},
): MugaDataLayerEntry => {
  return {
    event: eventName,
    page_path: window.location.pathname,
    page_url: window.location.href,
    timestamp: new Date().toISOString(),
    ...payload,
  };
};

const slugifyValue = (value: string) => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
};

const getGoatCounterEventLabel = (detail: MugaDataLayerEntry) => {
  const candidateKeys = ["label", "field_name", "form_context", "error_type"];

  for (const key of candidateKeys) {
    const value = detail[key];

    if (typeof value === "string" && value && value !== "unknown" && value !== "unspecified") {
      return value;
    }
  }

  return null;
};

const queueGoatCounterPayload = (payload: MugaGoatCounterPayload) => {
  if (!Array.isArray(mugaAnalyticsWindow.__mugaPendingGoatCounter)) {
    mugaAnalyticsWindow.__mugaPendingGoatCounter = [];
  }

  mugaAnalyticsWindow.__mugaPendingGoatCounter.push(payload);
};

const flushPendingGoatCounter = () => {
  const pendingPayloads = mugaAnalyticsWindow.__mugaPendingGoatCounter;
  const goatCounterCount = mugaAnalyticsWindow.goatcounter?.count;

  if (!Array.isArray(pendingPayloads) || typeof goatCounterCount !== "function") return;

  while (pendingPayloads.length > 0) {
    const payload = pendingPayloads.shift();

    if (!payload) continue;

    goatCounterCount(payload);
  }
};

const sendGoatCounterPayload = (payload: MugaGoatCounterPayload) => {
  const goatCounterCount = mugaAnalyticsWindow.goatcounter?.count;

  if (typeof goatCounterCount !== "function") {
    queueGoatCounterPayload(payload);
    return;
  }

  flushPendingGoatCounter();
  goatCounterCount(payload);
};

const trackGoatCounterEvent = (detail: MugaDataLayerEntry) => {
  const basePath = goatCounterEventMap[String(detail.event || "")];

  if (!basePath) return;

  const label = getGoatCounterEventLabel(detail);
  const path = label ? `${basePath}-${slugifyValue(label)}` : basePath;

  sendGoatCounterPayload({
    event: true,
    path,
    referrer: window.location.pathname,
    title: label || String(detail.event || "event"),
  });
};

const trackGoatCounterPageView = () => {
  sendGoatCounterPayload({
    path: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer || undefined,
    title: document.title,
  });
};

const emitTrackingEvent = (
  eventName: string,
  payload: Record<string, unknown> = {},
) => {
  const detail = buildEventDetail(eventName, payload);

  if (Array.isArray(mugaAnalyticsWindow.dataLayer)) {
    mugaAnalyticsWindow.dataLayer.push(detail);
  }

  trackGoatCounterEvent(detail);

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
  if (mugaAnalyticsWindow.__mugaLastTrackedPath === window.location.pathname) return;

  const funnelStep = getFunnelStep(window.location.pathname);

  emitTrackingEvent("page_view");
  trackGoatCounterPageView();

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
  trackPageView();
};

if (!mugaAnalyticsWindow.__mugaAnalyticsBound) {
  document.addEventListener("click", handleTrackedClick);
  document.addEventListener("change", handleTrackedSelect);
  document.addEventListener("muga:form-state", handleFormState as EventListener);
  document.addEventListener("DOMContentLoaded", initAnalytics);
  document.addEventListener("astro:page-load", initAnalytics);
  mugaAnalyticsWindow.__mugaAnalyticsBound = true;
}

if (!mugaAnalyticsWindow.__mugaGoatCounterFlushBound) {
  window.addEventListener("load", flushPendingGoatCounter);
  document.addEventListener("astro:page-load", flushPendingGoatCounter);
  mugaAnalyticsWindow.__mugaGoatCounterFlushBound = true;
}

initAnalytics();
