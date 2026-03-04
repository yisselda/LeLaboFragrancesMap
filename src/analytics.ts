type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    __gaInitialized?: boolean;
  }
}

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();

function isDoNotTrackEnabled(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const win = window as Window & { doNotTrack?: string };
  const nav = navigator as Navigator & { msDoNotTrack?: string };

  const doNotTrack =
    navigator.doNotTrack || win.doNotTrack || nav.msDoNotTrack;

  return doNotTrack === "1" || doNotTrack === "yes";
}

function loadGoogleTag(measurementId: string): void {
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
}

export function initAnalytics(): void {
  if (typeof window === "undefined") {
    return;
  }

  if (window.__gaInitialized) {
    return;
  }

  if (!import.meta.env.PROD) {
    return;
  }

  if (!GA_MEASUREMENT_ID) {
    return;
  }

  if (isDoNotTrackEnabled()) {
    return;
  }

  window.__gaInitialized = true;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag =
    window.gtag ??
    ((...args: unknown[]) => {
      window.dataLayer?.push(args);
    });

  loadGoogleTag(GA_MEASUREMENT_ID);
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    send_page_view: true,
    transport_type: "beacon",
  });
}
