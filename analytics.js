/* The Whacky Rack — analytics tracking v2
   v2 changes:
   - Click inserts use fetch with keepalive:true (survives page navigation on mobile)
   - Debug mode via ?debugAnalytics=1 (persists in localStorage until ?debugAnalytics=0)
   - Logs every step to browser console when debug is on
   - Captures user_id + is_anonymous for signed-in / anonymous clicker split */
(function () {
  var CONSENT_KEY     = "wr_cookie_consent_v1";
  var SESSION_KEY     = "wr_analytics_session_id";
  var PV_DEBOUNCE_KEY = "wr_analytics_last_pv";
  var DEBUG_KEY       = "wr_analytics_debug";

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

    try {
      var keys = Object.keys(localStorage);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k.indexOf("sb-") === 0 && k.indexOf("-auth-token") !== -1) {
          var parsed = JSON.parse(localStorage.getItem(k) || "{}");
          if (parsed && parsed.user && parsed.user.id) {
            _cachedUserId = parsed.user.id;
            _cachedUserIdResolved = true;
            return _cachedUserId;
          }
        }
      }
    } catch (e) {}

    _cachedUserId = null;
    _cachedUserIdResolved = true;
    return null;
  }

  /* ---------------- Wait for window.wr.sb ---------------- */
  function waitForSb(cb, tries) {
    tries = tries || 0;
    if (window.wr && window.wr.sb) return cb(window.wr.sb);
    if (tries > 100) { log("sb never became available — giving up"); return; }
    setTimeout(function () { waitForSb(cb, tries + 1); }, 50);
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

  /* ---------------- Page view ---------------- */
  function trackPageView(sb) {
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
    sb.from("analytics_page_views").insert(payload)
      .then(function (r) {
        if (r.error) log("page view ERROR:", r.error);
        else log("page view OK");
      })
      .catch(function (e) { log("page view THREW:", e); });
  }

  /* ---------------- Click insert (keepalive) ---------------- */
  function insertClickKeepalive(sb, payload) {
    var baseUrl = sb.supabaseUrl || "";
    var anonKey = sb.supabaseKey || "";

    if (!baseUrl || !anonKey) {
      log("no supabase url/key on client — falling back to SDK");
      return sb.from("analytics_link_clicks").insert(payload)
        .then(function (r) { log("fallback insert result", r); })
        .catch(function (e) { log("fallback insert threw", e); });
    }

    var url = baseUrl.replace(/\/+$/, "") + "/rest/v1/analytics_link_clicks";
    log("keepalive POST →", url, payload);

    return fetch(url, {
      method: "POST",
      headers: {
        "apikey": anonKey,
        "Authorization": "Bearer " + anonKey,
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
  }

  function trackLinkClick(sb, data) {
    var payload = basePayload();
    payload.product_id   = data.product_id || null;
    payload.product_name = data.product_name || null;
    payload.link_url     = data.link_url;
    payload.link_label   = data.link_label || null;
    payload.link_type    = data.link_type || "product";
         payload.screen_size  = window.innerWidth + "x" + window.innerHeight;
    payload.user_agent   = navigator.userAgent;

    log("click payload:", payload);
    insertClickKeepalive(sb, payload);
  }

  /* ---------------- Click detection ---------------- */
  function attachClickTracking(sb) {
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

      trackLinkClick(sb, {
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
    waitForSb(function (sb) {
      log("sb ready");
      trackPageView(sb);
      attachClickTracking(sb);
    });
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
