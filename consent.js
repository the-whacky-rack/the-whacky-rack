/* The Whacky Rack — cookie consent banner (EU/UK) */
(function () {
  const KEY = "wr_cookie_consent_v1";

    // Testing override: append ?forceConsent=1 to any URL to force the banner.
  const forceShow = new URLSearchParams(location.search).get("forceConsent") === "1";

  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  if (stored && stored.essential !== undefined && !forceShow) return;
  if (forceShow) {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const isEUUK = /Europe\//.test(tz) || /London|Dublin|Lisbon/.test(tz) || forceShow;

  const style = document.createElement("style");
  style.textContent = `
    .wr-consent {
      position: fixed; left: 16px; right: 16px; bottom: 16px;
      max-width: 640px; margin: auto;
      background: #fff; color: #202020;
      border: 1px solid #e8e4dc; border-radius: 16px;
      padding: 18px 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,.15);
      z-index: 1000000;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 14px; line-height: 1.55;
      display: flex; flex-direction: column; gap: 12px;
    }
    .wr-consent p { margin: 0; }
    .wr-consent a { color: #e84625; font-weight: 700; }
    .wr-consent-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .wr-consent button {
      font-family: inherit; font-weight: 800; font-size: 13px;
      padding: 10px 18px; border-radius: 50px; cursor: pointer;
      border: 1px solid transparent;
    }
    .wr-consent .accept { background: #ff5a36; color: #fff; border-color: #ff5a36; }
    .wr-consent .accept:hover { background: #e84625; }
    .wr-consent .reject { background: #fff; color: #444; border-color: #e8e4dc; }
    .wr-consent .reject:hover { border-color: #bbb; }
    .wr-consent .settings { background: transparent; color: #777; border: 0; padding: 0; }
    .wr-consent .settings:hover { color: #202020; text-decoration: underline; }
  `;
  document.head.appendChild(style);

  const el = document.createElement("div");
  el.className = "wr-consent";
  el.innerHTML = `
    <p>
      We use a small number of third-party services that may set cookies —
      Cloudflare Turnstile (bot protection), Amazon (affiliate links), and
      social platforms (only when you click share). We don't use analytics or
      advertising cookies ourselves. See our
      <a href="cookies.html">Cookie Policy</a>.
    </p>
    <div class="wr-consent-actions">
      <button class="accept" type="button">Accept all</button>
      <button class="reject" type="button">Reject non-essential</button>
      <button class="settings" type="button">Learn more</button>
    </div>
  `;
  document.body.appendChild(el);

  function save(value) {
    try { localStorage.setItem(KEY, JSON.stringify(value)); } catch (e) {}
    el.remove();
  }

  el.querySelector(".accept").addEventListener("click", function () {
    save({ essential: true, all: true });
  });
  el.querySelector(".reject").addEventListener("click", function () {
    save({ essential: true, all: false });
  });
  el.querySelector(".settings").addEventListener("click", function () {
    window.location.href = "cookies.html";
  });

  if (!isEUUK) save({ essential: true, all: true });
})();
