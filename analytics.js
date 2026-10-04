/* The Whacky Rack — analytics tracking v3
   v3 changes:
   - Always uses fetch with keepalive:true (mobile clicks survive navigation)
   - Constants hardcoded (same anon key already served by auth.js)
   - No more fallback to SDK insert */
(function () {
  var CONSENT_KEY     = "wr_cookie_consent_v1";
  var SESSION_KEY     = "wr_analytics_session_id";
  var PV_DEBOUNCE_KEY = "wr_analytics_last_pv";
  var DEBUG_KEY       = "wr_analytics_debug";

  // Same values as auth.js — the anon key is public and safe to expose.
  var SUPABASE_URL = "https://rmqoayzrplotejgnnvov.supabase.co";
  var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtcW9heXpycGxvdGVqZ25udm92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NDIzNDAsImV4cCI6MjEwNTExODM0MH0.MyIJizHgA-b3L8t9-qYB_1ac5K0_yk7DrFWKnqIOEN8";

  var EXCLUDED_PATHS = [/\/analytics\.html?$/i, /\/admin\.html?$/i];

  /* ---------------- Debug ---------------- */
  var DEBUG = false;
  try {
    var qp = new URLSearchParams(location.search);
    if (qp.get("debugAnalytics") === "1") {
      DEBUG = true;
      localStorage.setItem(DEBUG_KEY, "1");
    }
    if (qp.get("debugAnalytics") === "0") {
      DEBUG = false;
      localStorage.removeItem(DEBUG_KEY);
    }
    if (localStorage.getItem(DEBUG_KEY) === "1") DEBUG = true;
  } catch (e) {}

  function log() {
    if (!DEBUG) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift("[analytics]");
    console.log.apply(console, args);
  }

  /* ---------------- Consent gate ---------------- */
  function hasFullConsent() {
    try {
      var raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      return parsed && parsed.all === true;
    } catch (e) { return false; }
  }

  /* ---------------- Session ID ---------------- */
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

  /* ---------------- Current user detection ---------------- */
  var _cachedUserId = null;
  var _cachedUserIdResolved = false;

  function detectCurrentUser() {
    if (_cachedUserIdResolved) return _cachedUserId;

    try {
      if (window.wr && typeof window.wr.getProfile === "function") {
        var p = window.wr.getProfile();
        if (p && p.id) {
          _cachedUserId = p.id;
          _cachedUserIdResolved = true;
          return _cachedUserId;
        }
      }
    } catch (e) {}

    _cachedUserId = null;
    _cachedUserIdResolved = true;
    return null;
  }

  /* ---------------- Base payload ---------------- */
  function basePayload() {
    var uid = detectCurrentUser();
    return {
      session_id:   getSessionId(),
      page_path:    location.pathname + location.search,
      timezone:     (Intl.DateTimeFormat().resolvedOptions().timeZone) || null,
      language:     navigator.language || null,
      referrer:     document.referrer || null,
      consented:    true,
      user_id:      uid,
      is_anonymous: uid === null
    };
  }

  /* ---------------- Insert helper (always keepalive) ---------------- */
  function insertKeepalive(table, payload) {
    var url = SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/" + table;
    log("keepalive POST →", url, payload);

    try {
      return fetch(url, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": "Bearer " + SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(payload),
        keepalive: true
      })
      .then(function (res) {
        log("keepalive HTTP status:", res.status);
        if (!res.ok) {
          return res.text().then(function (t) { log("keepalive error body:", t); });
        }
      })
      .catch(function (e) { log("keepalive fetch THREW:", e); });
    } catch (e) {
      log("keepalive setup THREW:", e);
    }
  }

  /* ---------------- Page view ---------------- */
  function trackPageView() {
    for (var i = 0; i < EXCLUDED_PATHS.length; i++) {
      if (EXCLUDED_PATHS[i].test(location.pathname)) { log("excluded path — skip"); return; }
    }

    try {
      var key = PV_DEBOUNCE_KEY + ":" + location.pathname;
      var last = parseInt(sessionStorage.getItem(key) || "0", 10);
      var now = Date.now();
      if (now - last < 60 * 1000) { log("page view debounced"); return; }
      sessionStorage.setItem(key, String(now));
    } catch (e) {}

    var payload = basePayload();
    payload.screen_size = window.innerWidth + "x" + window.innerHeight;
    payload.user_agent  = navigator.userAgent;

    log("page view payload:", payload);
    insertKeepalive("analytics_page_views", payload);
  }

  /* ---------------- Click tracking ---------------- */
  function trackLinkClick(data) {
    var payload = basePayload();
    payload.product_id   = data.product_id || null;
    payload.product_name = data.product_name || null;
    payload.link_url     = data.link_url;
    payload.link_label   = data.link_label || null;
    payload.link_type    = data.link_type || "product";
    payload.screen_size  = window.innerWidth + "x" + window.innerHeight;
    payload.user_agent   = navigator.userAgent;

    log("click payload:", payload);
    insertKeepalive("analytics_link_clicks", payload);
  }

  /* ---------------- Click detection ---------------- */
  function attachClickTracking() {
    log("click tracker attached");
    document.addEventListener("click", function (e) {
      var link = e.target.closest("a[href]");
      if (!link) { log("click: no anchor found"); return; }

      var href = link.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#") { log("click: skip empty/hash href"); return; }

      var isExternal  = link.target === "_blank" || /^https?:\/\//i.test(href);
      var isSponsored = (link.getAttribute("rel") || "").indexOf("sponsored") !== -1;
      var isAmazon    = /amazon\./i.test(href) || /amzn\.to/i.test(href);
      var isShare     = link.classList.contains("share-option");

      if (!isExternal && !isSponsored && !isAmazon && !isShare) {
        log("click: not a tracked link", href);
        return;
      }

      var productId = null;
      var productName = null;

      var card = link.closest(".product-card");
      if (card) {
        var nameEl = card.querySelector(".product-name");
        if (nameEl) productName = nameEl.textContent.trim();
        var tapeBtn = card.querySelector("[data-product-id]");
        if (tapeBtn && tapeBtn.dataset.productId) {
          productId = parseInt(tapeBtn.dataset.productId, 10) || null;
        }
      }

      if (!productName && isShare) {
        var sn = document.getElementById("shareProductName");
        if (sn) productName = sn.textContent.trim();
      }

      var linkType = isAmazon   ? "amazon"
                   : isShare    ? "share"
                   : isExternal ? "external"
                   : "internal";

      log("click tracked:", { type: linkType, product: productName, href: href });

      trackLinkClick({
        product_id:   productId,
        product_name: productName,
        link_url:     href,
        link_label:   (link.textContent || "").trim().slice(0, 120),
        link_type:    linkType
      });
    }, true);
  }

  /* ---------------- Start ---------------- */
  var started = false;
  function runTracking() {
    if (started) return;
    started = true;
    log("starting tracking…");
    trackPageView();
    attachClickTracking();
  }

  function init() {
    log("init — consent state:", hasFullConsent());
    if (hasFullConsent()) {
      runTracking();
      return;
    }

    var attempts = 0;
    var timer = setInterval(function () {
      attempts++;
      if (hasFullConsent()) {
        clearInterval(timer);
        log("consent detected via poll");
        runTracking();
      } else if (attempts > 300) {
        clearInterval(timer);
      }
    }, 1000);

    window.addEventListener("wr-consent-accepted", function () {
      clearInterval(timer);
      log("consent detected via event");
      runTracking();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
