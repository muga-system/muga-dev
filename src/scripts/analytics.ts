type MugaDataLayerEntry = Record<string, unknown>;

type MugaAnalyticsWindow = Window &
  typeof globalThis & {
    dataLayer?: MugaDataLayerEntry[];
    __mugaAnalyticsBound?: boolean;
    __mugaLastTrackedPath?: string;
  };

const mugaAnalyticsWindow = window as MugaAnalyticsWindow;

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

const emitTrackingEvent = (
  eventName: string,
  payload: Record<string, unknown> = {},
) => {
  const detail = buildEventDetail(eventName, payload);

  if (Array.isArray(mugaAnalyticsWindow.dataLayer)) {
    mugaAnalyticsWindow.dataLayer.push(detail);
  }

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

initAnalytics();
