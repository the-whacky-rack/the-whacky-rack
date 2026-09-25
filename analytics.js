/* The Whacky Rack — analytics tracking
   Requires: consent.js loaded first, and consent must be 'Accept all'.
   Records page views and link clicks. IP + country are filled server-side. */
(function () {
  var CONSENT_KEY   = "wr_cookie_consent_v1";
  var SESSION_KEY   = "wr_analytics_session_id";
  var PV_DEBOUNCE_KEY = "wr_analytics_last_pv";

  // Pages we don't track (avoid self-tracking the dashboard and admin)
  var EXCLUDED_PATHS = [
    /\/analytics\.html?$/i,
    /\/admin\.html?$/i
  ];

  /* ------------------------------------------------------------
     Consent gate
     ------------------------------------------------------------ */
  function hasFullConsent() {
    try {
      var raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      return parsed && parsed.all === true;
    } catch (e) {
      return false;
    }
  }

  /* ------------------------------------------------------------
     Anonymous session ID (per browser, not linked to any account)
     ------------------------------------------------------------ */
  function getSessionId() {
    try {
      var id = localStorage.getItem(SESSION_KEY);
      if (!id) {
        id = (window.crypto && crypto.randomUUID)
          ? crypto.randomUUID()
          : ("sid-" + Date.now() + "-" + Math.random().toString(36).slice(2, 12));
        localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (e) {
      return "sid-fallback-" + Math.random().toString(36).slice(2, 12);
    }
  }

  /* ------------------------------------------------------------
     Wait for window.wr.sb to be ready
     ------------------------------------------------------------ */
  function waitForSb(cb, tries) {
    tries = tries || 0;
    if (window.wr && window.wr.sb) return cb(window.wr.sb);
    if (tries > 100) return; // ~5s timeout, then give up silently
    setTimeout(function () { waitForSb(cb, tries + 1); }, 50);
  }

  /* ------------------------------------------------------------
     Common payload for both tables
     ------------------------------------------------------------ */
  function basePayload() {
    return {
      session_id: getSessionId(),
      page_path: location.pathname + location.search,
      timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone) || null,
      language: navigator.language || null,
      referrer: document.referrer || null,
      consented: true
    };
  }

  /* ------------------------------------------------------------
     Page view
     ------------------------------------------------------------ */
  function trackPageView(sb) {
    // Skip excluded pages
    for (var i = 0; i < EXCLUDED_PATHS.length; i++) {
      if (EXCLUDED_PATHS[i].test(location.pathname)) return;
    }

    // Debounce: one page view per session per page per minute
    try {
      var key = PV_DEBOUNCE_KEY + ":" + location.pathname;
      var last = parseInt(sessionStorage.getItem(key) || "0", 10);
      var now = Date.now();
      if (now - last < 60 * 1000) return;
      sessionStorage.setItem(key, String(now));
    } catch (e) { /* ignore */ }

    var payload = basePayload();
    payload.screen_size = window.innerWidth + "x" + window.innerHeight;
    payload.user_agent  = navigator.userAgent;

    sb.from("analytics_page_views").insert(payload)
      .then(function (r) {
        if (r.error) console.debug("pv insert:", r.error.message);
      })
      .catch(function () { /* silent */ });
  }

  /* ------------------------------------------------------------
     Link click
     ------------------------------------------------------------ */
  function trackLinkClick(sb, data) {
    var payload = basePayload();
    payload.product_id   = data.product_id || null;
    payload.product_name = data.product_name || null;
    payload.link_url     = data.link_url;
    payload.link_label   = data.link_label || null;
    payload.link_type    = data.link_type || "product";
    payload.user_agent   = navigator.userAgent;

    sb.from("analytics_link_clicks").insert(payload)
      .then(function (r) {
        if (r.error) console.debug("lc insert:", r.error.message);
      })
      .catch(function () { /* silent */ });
  }

  /* ------------------------------------------------------------
     Attach click tracking (capture phase so we never miss)
     ------------------------------------------------------------ */
  function attachClickTracking(sb) {
    document.addEventListener("click", function (e) {
      var link = e.target.closest("a[href]");
      if (!link) return;

      var href = link.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#") return;

      var isExternal  = link.target === "_blank" || /^https?:\/\//i.test(href);
      var isSponsored = (link.getAttribute("rel") || "").indexOf("sponsored") !== -1;
      var isAmazon    = /amazon\./i.test(href) || /amzn\.to/i.test(href);
      var isShare     = link.classList.contains("share-option");

      if (!isExternal && !isSponsored && !isAmazon && !isShare) return;

      var productId = null;
      var productName = null;

      // Try to find the product card that this link belongs to
      var card = link.closest(".product-card");
      if (card) {
        var nameEl = card.querySelector(".product-name");
        if (nameEl) productName = nameEl.textContent.trim();
        var tapeBtn = card.querySelector("[data-product-id]");
        if (tapeBtn && tapeBtn.dataset.productId) {
          productId = parseInt(tapeBtn.dataset.productId, 10) || null;
        }
      }

      // For share modal clicks, grab the product name from the modal
      if (!productName && isShare) {
        var sn = document.getElementById("shareProductName");
        if (sn) productName = sn.textContent.trim();
      }

      var linkType = isAmazon  ? "amazon"
                   : isShare   ? "share"
                   : isExternal ? "external"
                   : "internal";

      trackLinkClick(sb, {
        product_id:   productId,
        product_name: productName,
        link_url:     href,
        link_label:   (link.textContent || "").trim().slice(0, 120),
        link_type:    linkType
      });
    }, true); // capture phase
  }

  /* ------------------------------------------------------------
     Main loop — poll for consent (in case user accepts after load)
     ------------------------------------------------------------ */
  var started = false;

  function runTracking() {
    if (started) return;
    started = true;
    waitForSb(function (sb) {
      trackPageView(sb);
      attachClickTracking(sb);
    });
  }

  function init() {
    if (hasFullConsent()) {
      runTracking();
      return;
    }

    // Poll for up to 5 minutes in case the user accepts later
    var attempts = 0;
    var timer = setInterval(function () {
      attempts++;
      if (hasFullConsent()) {
        clearInterval(timer);
        runTracking();
      } else if (attempts > 300) {
        clearInterval(timer);
      }
    }, 1000);

    // Also listen for a custom event (if consent.js is updated to fire it)
    window.addEventListener("wr-consent-accepted", function () {
      clearInterval(timer);
      runTracking();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
