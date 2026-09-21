/* The Whacky Rack — shared report button + modal
   Requires auth.js loaded first. */

(function () {
  if (!window.wr || !window.wr.sb) {
    console.warn("report.js: auth.js must load first");
    return;
  }

  const sb = window.wr.sb;

  /* ---------- Styles ---------- */
  const style = document.createElement("style");
  style.textContent = `
    .wr-report-link {
      background: transparent;
      border: 0;
      color: #999;
      font-family: inherit;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      padding: 0;
      transition: .15s ease;
    }
    .wr-report-link:hover { color: #c2410c; text-decoration: underline; }

    .wr-report-modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.5);
      z-index: 100000;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .wr-report-modal.open { display: flex; }

    .wr-report-inner {
      background: #fff;
      border-radius: 20px;
      padding: 26px;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,.25);
      position: relative;
      animation: wrRepIn .18s ease-out;
    }
    @keyframes wrRepIn {
      from { opacity: 0; transform: translateY(10px) scale(.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .wr-report-close {
      position: absolute;
      top: 12px; right: 12px;
      width: 32px; height: 32px;
      border: 0; background: #f1eee8;
      border-radius: 50%; font-size: 20px;
      line-height: 1; cursor: pointer; color: #555;
      display: flex; align-items: center; justify-content: center;
      font-family: inherit;
    }
    .wr-report-close:hover { background: #e8e4dc; color: #222; }

    .wr-report-inner h3 {
      margin: 0 0 4px;
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -.3px;
    }
    .wr-report-inner .wr-rep-sub {
      margin: 0 0 16px;
      font-size: 13px;
      color: #777;
    }
    .wr-report-inner .wr-rep-preview {
      background: #fafafa;
      border: 1px solid #e8e4dc;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 12px;
      color: #555;
      margin-bottom: 14px;
      word-wrap: break-word;
      max-height: 80px;
      overflow-y: auto;
    }
    .wr-report-inner label {
      display: block;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .4px;
      color: #555;
      margin: 0 0 6px;
    }
    .wr-report-inner textarea {
      width: 100%;
      padding: 11px 13px;
      font-family: inherit;
      font-size: 14px;
      background: #fafafa;
      border: 1px solid #e8e4dc;
      border-radius: 12px;
      outline: none;
      resize: vertical;
      min-height: 90px;
      color: #202020;
    }
    .wr-report-inner textarea:focus {
      border-color: #ff5a36;
      background: #fff;
    }
    .wr-report-char {
      font-size: 11px;
      color: #777;
      text-align: right;
      margin-top: 4px;
    }
    .wr-report-status {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      font-size: 12px;
      display: none;
    }
    .wr-report-status.show { display: block; }
    .wr-report-status.err { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .wr-report-status.ok { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }

    .wr-report-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 18px;
    }
    .wr-report-btn-ghost,
    .wr-report-btn-primary {
      padding: 11px 20px;
      border-radius: 50px;
      font-family: inherit;
      font-weight: 800;
      font-size: 13px;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .wr-report-btn-ghost {
      background: #fff; color: #444; border-color: #e8e4dc;
    }
    .wr-report-btn-ghost:hover { border-color: #bbb; }
    .wr-report-btn-primary {
      background: #ff5a36; color: #fff; border-color: #ff5a36;
    }
    .wr-report-btn-primary:hover:not(:disabled) { background: #e84625; border-color: #e84625; }
    .wr-report-btn-primary:disabled { opacity: .5; cursor: not-allowed; }

    @media (max-width: 700px) {
      .wr-report-inner { padding: 22px 20px; border-radius: 16px; }
      .wr-report-inner h3 { font-size: 18px; }
    }
  `;
  document.head.appendChild(style);

  /* ---------- Modal ---------- */
  const modal = document.createElement("div");
  modal.className = "wr-report-modal";
  modal.id = "wr-report-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="wr-report-inner">
      <button class="wr-report-close" type="button" aria-label="Close" id="wr-rep-close">×</button>
      <h3>Report</h3>
      <p class="wr-rep-sub">Tell us what's wrong. Reports are private — the author won't see your name.</p>
      <div class="wr-rep-preview" id="wr-rep-preview"></div>
      <label for="wr-rep-reason">What's the problem?</label>
      <textarea id="wr-rep-reason" maxlength="500" placeholder="Be specific. What did you see? (min 3 characters)"></textarea>
      <div class="wr-report-char"><span id="wr-rep-count">0</span> / 500</div>
      <div class="wr-report-status" id="wr-rep-status"></div>
      <div class="wr-report-actions">
        <button class="wr-report-btn-ghost" type="button" id="wr-rep-cancel">Cancel</button>
        <button class="wr-report-btn-primary" type="button" id="wr-rep-submit" disabled>Submit report</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const els = {
    preview: document.getElementById("wr-rep-preview"),
    reason: document.getElementById("wr-rep-reason"),
    count: document.getElementById("wr-rep-count"),
    status: document.getElementById("wr-rep-status"),
    submit: document.getElementById("wr-rep-submit"),
    close: document.getElementById("wr-rep-close"),
    cancel: document.getElementById("wr-rep-cancel")
  };

  let currentTarget = null; // { type, id, label }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function open(targetType, targetId, label) {
    // Signed-in check
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        const go = confirm("You need to sign in to report content. Sign in now?");
        if (go) location.href = "login.html";
        return;
      }

      currentTarget = { type: targetType, id: targetId, label: label || "" };
      els.preview.textContent = label ? String(label).slice(0, 180) : "(no preview)";
      els.reason.value = "";
      els.count.textContent = "0";
      els.submit.disabled = true;
      els.submit.textContent = "Submit report";
      els.status.className = "wr-report-status";
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      setTimeout(() => els.reason.focus(), 100);
    });
  }

  function close() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    currentTarget = null;
  }

  els.reason.addEventListener("input", () => {
    els.count.textContent = String(els.reason.value.length);
    els.submit.disabled = els.reason.value.trim().length < 3;
  });

  els.close.addEventListener("click", close);
  els.cancel.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("open")) close();
  });

  els.submit.addEventListener("click", async () => {
    if (!currentTarget) return;
    const reason = els.reason.value.trim();
    if (reason.length < 3) return;

    els.submit.disabled = true;
    els.submit.textContent = "Submitting…";
    els.status.className = "wr-report-status";

    try {
      const { error } = await sb.rpc("report_content", {
        p_target_type: currentTarget.type,
        p_target_id: currentTarget.id,
        p_reason: reason
      });
      if (error) throw error;

      els.status.className = "wr-report-status show ok";
      els.status.textContent = "Thanks — report submitted. We'll review it.";
      setTimeout(close, 1200);
    } catch (err) {
      console.error(err);
      els.status.className = "wr-report-status show err";
      els.status.textContent = err.message || "Could not submit report.";
      els.submit.disabled = false;
      els.submit.textContent = "Submit report";
    }
  });

  /* ---------- Public API ---------- */
  window.report = {
    open,
    /** Render a small inline report link as a string */
    link(targetType, targetId, label) {
      return `<button type="button" class="wr-report-link" data-report-type="${esc(targetType)}" data-report-id="${esc(targetId)}" data-report-label="${esc(label || "")}">Report</button>`;
    }
  };

  /* Delegated click handling */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".wr-report-link");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    open(btn.dataset.reportType, btn.dataset.reportId, btn.dataset.reportLabel);
  });
})();
