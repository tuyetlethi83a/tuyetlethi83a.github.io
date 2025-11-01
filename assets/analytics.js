// REPLACE WHOLE FILE: /assets/analytics.js
(() => {
  // FIND: GA_ID
  const GA_ID = "G-6WLTPVXXG6"; // GA4 - tuyetlethi

  // Ensure dataLayer + gtag
  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }
  if (typeof window.gtag !== "function") window.gtag = gtag;

  // Load GA script once
  if (!document.querySelector(`script[data-ga4="${GA_ID}"]`)) {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
    s.setAttribute("data-ga4", GA_ID);
    document.head.appendChild(s);
  }

  // Init + config
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);
})();
