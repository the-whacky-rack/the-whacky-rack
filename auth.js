/* The Whacky Rack — shared auth + header injection */

(function () {
  const SUPABASE_URL = "https://rmqoayzrplotejgnnvov.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtcW9heXpycGxvdGVqZ25udm92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NDIzNDAsImV4cCI6MjEwNTExODM0MH0.MyIJizHgA-b3L8t9-qYB_1ac5K0_yk7DrFWKnqIOEN8";

  if (!window.supabase || !window.supabase.createClient) {
    console.warn("Supabase SDK not loaded — auth.js needs it before this file.");
    return;
  }

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  /* ---------- Styles (injected once) ---------- */
  const style = document.createElement("style");
  style.textContent = `
    .wr-auth-area { display: flex; align-items: center; gap: 10px; }
    .wr-auth-user {
      font-size: 13px; font-weight: 800; color: #202020; text-decoration: none;
      padding: 8px 14px; border-radius: 50px;
      background: #fff0eb; border: 1px solid #ff5a36;
      white-space: nowrap; transition: .2s ease;
    }
    .wr-auth-user:hover { background: #ffe2d8; }
    .wr-auth-logout {
      font-size: 12px; font-weight: 700;
      background: transparent; border: 1px solid #e8e4dc;
      color: #777; padding: 7px 12px; border-radius: 50px;
      cursor: pointer; font-family: inherit; transition: .2s ease;
    }
    .wr-auth-logout:hover { border-color: #bbb; color: #202020; }
    .wr-auth-cta {
      font-size: 13px; font-weight: 700;
      padding: 8px 14px; border-radius: 50px;
      text-decoration: none; white-space: nowrap; transition: .2s ease;
    }
    .wr-auth-signin { background: #fff; color: #202020; border: 1px solid #e8e4dc; }
    .wr-auth-signin:hover { border-color: #bbb; }
    .wr-auth-join { background: #ff5a36; color: #fff; border: 1px solid #ff5a36; }
    .wr-auth-join:hover { background: #e84625; border-color: #e84625; }
    @media (max-width: 700px) {
      .wr-auth-user, .wr-auth-logout, .wr-auth-cta { font-size: 11px; padding: 7px 11px; }
    }
  `;
  document.head.appendChild(style);

  /* ---------- Escape ---------- */
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  /* ---------- Header injection ---------- */
  function getArea() {
    let area = document.querySelector(".wr-auth-area");
    if (area) return area;
    const headerRight = document.querySelector("header .header-right");
    if (!headerRight) return null;
    area = document.createElement("div");
    area.className = "wr-auth-area";
    headerRight.appendChild(area);
    return area;
  }

  function render(session, profile) {
    const area = getArea();
    if (!area) return;

    if (session && profile) {
      area.innerHTML = `
        <a class="wr-auth-user" href="profile.html" title="Your profile">
          ${esc(profile.username)}
        </a>
        <button class="wr-auth-logout" type="button" id="wr-logout-btn">Logout</button>
      `;
      const btn = document.getElementById("wr-logout-btn");
      if (btn) btn.addEventListener("click", async () => {
        await sb.auth.signOut();
        window.location.reload();
      });
    } else if (session) {
      area.innerHTML = `<span class="wr-auth-user">…</span>`;
    } else {
      area.innerHTML = `
        <a class="wr-auth-signin wr-auth-cta" href="login.html">Sign in</a>
        <a class="wr-auth-join wr-auth-cta" href="signup.html">Join</a>
      `;
    }
  }

  /* ---------- Profile lookup ---------- */
  let cached = null;

  async function fetchProfile(userId) {
    const { data, error } = await sb.from("profiles")
      .select("id, username, rank, bio, country, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (error) { console.warn("profile fetch:", error); return null; }
    return data;
  }

  async function refresh() {
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) {
      if (!cached || cached.id !== session.user.id) {
        cached = await fetchProfile(session.user.id);
      }
      render(session, cached);
    } else {
      cached = null;
      render(null, null);
    }
  }

  sb.auth.onAuthStateChange(() => { cached = null; refresh(); });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh);
  } else {
    refresh();
  }

  /* ---------- Public API ---------- */
  window.wr = {
    sb,
    refresh,
    getProfile: () => cached,
    async requireAuth(redirect = "login.html") {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { window.location.href = redirect; return null; }
      return session;
    },
    async requireProfile() {
      const session = await this.requireAuth();
      if (!session) return null;
      let p = cached;
      if (!p || p.id !== session.user.id) {
        p = await fetchProfile(session.user.id);
        cached = p;
      }
      return p;
    },
    async signOut() { await sb.auth.signOut(); }
  };
})();
