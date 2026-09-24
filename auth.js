/* The Whacky Rack — shared auth + header injection + notifications bell */

(function () {
const SUPABASE_URL = "https://rmqoayzrplotejgnnvov.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtcW9heXpycGxvdGVqZ25udm92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NDIzNDAsImV4cCI6MjEwNTExODM0MH0.MyIJizHgA-b3L8t9-qYB_1ac5K0_yk7DrFWKnqIOEN8";

if (!window.supabase || !window.supabase.createClient) {
console.warn("Supabase SDK not loaded — auth.js needs it before this file.");
return;
}

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------- Module state ---------- */
let session = null;
let cached = null; // cached profile row for the current user
let unreadCount = 0;
let notifChannel = null;
let subscribedUserId = null;
let panelEl = null;

/* ---------- Styles ---------- */
const style = document.createElement("style");
style.textContent = `
header .header-right { flex-wrap: wrap; }
.wr-auth-area { display: flex; align-items: center; gap: 10px; }

.wr-auth-user {
font-size: 13px; font-weight: 800; color: #202020; text-decoration: none;
padding: 8px 14px; border-radius: 50px;
background: #fff0eb; border: 1px solid #ff5a36;
white-space: nowrap; transition: .2s ease;
}
.wr-auth-user:hover { background: #ffe2d8; }

.wr-bell {
position: relative;
width: 36px; height: 36px; border-radius: 50%;
background: #fff; border: 1px solid #e8e4dc;
font-size: 16px; cursor: pointer;
display: flex; align-items: center; justify-content: center;
font-family: inherit; padding: 0;
transition: .2s ease;
}
.wr-bell:hover { border-color: #bbb; background: #fafafa; }

.wr-bell-badge {
position: absolute;
top: -6px; right: -6px;
min-width: 18px; height: 18px;
padding: 0 5px;
border-radius: 9px;
background: #ff5a36; color: #fff;
font-size: 10px; font-weight: 900;
display: none;
align-items: center; justify-content: center;
line-height: 1;
border: 2px solid #fff;
box-sizing: content-box;
}
.wr-bell-badge.show { display: flex; }

.wr-auth-settings {
display: inline-flex; align-items: center; justify-content: center;
width: 36px; height: 36px; border-radius: 50%;
background: #fff; border: 1px solid #e8e4dc;
font-size: 15px; text-decoration: none;
transition: .2s ease;
}
.wr-auth-settings:hover { border-color: #bbb; background: #fafafa; }

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

/* Notification panel */
.wr-bell-panel {
display: none;
position: fixed;
z-index: 100001;
width: 340px;
max-width: calc(100vw - 24px);
background: #fff;
border: 1px solid #e8e4dc;
border-radius: 16px;
box-shadow: 0 20px 60px rgba(0,0,0,.18);
overflow: hidden;
animation: wrBellIn .18s ease-out;
}
.wr-bell-panel.open { display: block; }
@keyframes wrBellIn {
from { opacity: 0; transform: translateY(-6px); }
to { opacity: 1; transform: translateY(0); }
}
.wr-bell-head {
display: flex; align-items: center; justify-content: space-between;
padding: 14px 16px;
border-bottom: 1px solid #e8e4dc;
background: #fafafa;
gap: 12px;
}
.wr-bell-head h3 {
margin: 0; font-size: 12px; font-weight: 900;
text-transform: uppercase; letter-spacing: .5px; color: #555;
}
.wr-bell-head button {
background: transparent; border: 0; color: #ff5a36;
font-size: 11px; font-weight: 800; cursor: pointer;
font-family: inherit; padding: 0;
white-space: nowrap;
}
.wr-bell-head button:hover { text-decoration: underline; }
.wr-bell-head button:disabled { opacity: .4; cursor: not-allowed; text-decoration: none; }

.wr-bell-body { max-height: 400px; overflow-y: auto; }

.wr-notif-row {
display: flex; gap: 10px; align-items: flex-start;
padding: 12px 16px;
border-bottom: 1px solid #f5f2ea;
cursor: pointer;
transition: .15s ease;
}
.wr-notif-row:last-child { border-bottom: 0; }
.wr-notif-row:hover { background: #fafafa; }
.wr-notif-row.unread { background: #fff5f0; }
.wr-notif-row.unread:hover { background: #ffe9e0; }

.wr-notif-icon {
width: 34px; height: 34px; border-radius: 50%;
background: #fff0eb; color: #ff5a36;
display: flex; align-items: center; justify-content: center;
font-size: 15px; flex-shrink: 0;
line-height: 1;
}

.wr-notif-body { flex: 1; min-width: 0; }
.wr-notif-text {
font-size: 13px; line-height: 1.45;
color: #333; margin-bottom: 2px;
word-wrap: break-word;
}
.wr-notif-text strong { color: #202020; font-weight: 800; }
.wr-notif-text .snippet { color: #888; font-style: italic; }
.wr-notif-time { font-size: 11px; color: #999; }

.wr-notif-empty {
text-align: center;
padding: 30px 20px;
color: #999;
font-size: 13px;
line-height: 1.5;
}
.wr-notif-empty .emoji { font-size: 32px; margin-bottom: 6px; }

.wr-bell-foot {
padding: 10px 16px;
border-top: 1px solid #e8e4dc;
background: #fafafa;
text-align: center;
}
.wr-bell-foot a {
color: #ff5a36; font-size: 12px; font-weight: 800;
text-decoration: none;
}
.wr-bell-foot a:hover { text-decoration: underline; }

@media (max-width: 700px) {
.wr-auth-user, .wr-auth-logout, .wr-auth-cta { font-size: 11px; padding: 7px 11px; }
.wr-bell, .wr-auth-settings { width: 32px; height: 32px; font-size: 14px; }
.wr-bell-panel { width: calc(100vw - 20px); }
}
`;
document.head.appendChild(style);

/* ---------- Utils ---------- */
function esc(s) {
return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
        }[c]));
        }

        function timeAgo(iso) {
        const d = new Date(iso);
        const s = Math.floor((Date.now() - d.getTime()) / 1000);
        if (s < 60) return "just now" ; if (s < 3600) return Math.floor(s/60) + "m ago" ; if (s < 86400) return Math.floor(s/3600) + "h ago" ; if (s < 604800) return Math.floor(s/86400) + "d ago" ; if (s < 2592000) return Math.floor(s/604800) + "w ago" ; return d.toLocaleDateString(); } /* ---------- Header injection ---------- */ function getArea() { let area=document.querySelector(".wr-auth-area"); if (area) return area; const headerRight=document.querySelector("header .header-right"); if (!headerRight) return null; area=document.createElement("div"); area.className="wr-auth-area" ; headerRight.appendChild(area); return area; } /* ---------- Notification panel element ---------- */ function getPanel() { if (panelEl && document.body.contains(panelEl)) return panelEl; panelEl=document.createElement("div"); panelEl.className="wr-bell-panel" ; panelEl.setAttribute("role", "dialog" ); document.body.appendChild(panelEl); return panelEl; } function closePanel() { const p=getPanel(); p.classList.remove("open"); } function positionPanel() { const bell=document.querySelector(".wr-bell"); if (!bell) return; const p=getPanel(); const rect=bell.getBoundingClientRect(); const panelWidth=Math.min(340, window.innerWidth - 20); p.style.width=panelWidth + "px" ; let right=window.innerWidth - rect.right; if (right < 10) right=10; if (right + panelWidth> window.innerWidth - 10) {
            right = 10;
            }

            p.style.top = (rect.bottom + 8) + "px";
            p.style.right = right + "px";
            }

            /* ---------- Notification rendering ---------- */
            function notifMeta(n) {
            const actor = n.actor?.username || "Someone";
            const actorId = n.actor?.id || n.actor_id || "";
            const followUrl = `profile.html?id=${actorId}`;

            switch (n.type) {
            case "follow":
            return {
            icon: "👤",
            text: `<strong>${esc(actor)}</strong> started following you`,
            url: followUrl
            };
            case "yap_comment":
            return {
            icon: "💬",
            text: `<strong>${esc(actor)}</strong> commented on your Yap` +
            (n.snippet ? ` <span class="snippet">"${esc(n.snippet)}"</span>` : ""),
            url: n.context_id ? `yap-thread.html?id=${n.context_id}` : "#"
            };
            case "yap_reply":
            return {
            icon: "↪️",
            text: `<strong>${esc(actor)}</strong> replied to your comment` +
            (n.snippet ? ` <span class="snippet">"${esc(n.snippet)}"</span>` : ""),
            url: n.context_id ? `yap-thread.html?id=${n.context_id}` : "#"
            };
            case "tape_comment":
            return {
            icon: "💬",
            text: `<strong>${esc(actor)}</strong> commented on your Tape` +
            (n.snippet ? ` <span class="snippet">"${esc(n.snippet)}"</span>` : ""),
            url: n.context_id ? `tape-thread.html?id=${n.context_id}` : "#"
            };
            case "tape_reply":
            return {
            icon: "↪️",
            text: `<strong>${esc(actor)}</strong> replied to your comment` +
            (n.snippet ? ` <span class="snippet">"${esc(n.snippet)}"</span>` : ""),
            url: n.context_id ? `tape-thread.html?id=${n.context_id}` : "#"
            };
            case "tape_reaction":
            return {
            icon: n.snippet || "👍",
            text: `<strong>${esc(actor)}</strong> reacted to your Tape`,
            url: n.context_id ? `tape-thread.html?id=${n.context_id}` : "#"
            };
            case "comment_upvote":
            return {
            icon: "▲",
            text: `<strong>${esc(actor)}</strong> upvoted your comment`,
            url: n.context_id ? `yap-thread.html?id=${n.context_id}` : "#"
            };
            default:
            return { icon: "🔔", text: "New activity", url: "#" };
            }
            }

            function renderPanel(notifications) {
            const p = getPanel();
            const unread = notifications.filter(n => !n.is_read).length;

            let bodyHtml;
            if (!notifications || notifications.length === 0) {
            bodyHtml = `
            <div class="wr-notif-empty">
                <div class="emoji">🔕</div>
                Nothing yet. When someone follows you, replies, or reacts — it'll show up here.
            </div>
            `;
            } else {
            bodyHtml = notifications.map(n => {
            const meta = notifMeta(n);
            return `
            <div class="wr-notif-row${n.is_read ? "" : " unread"}" data-notif-id="${esc(n.id)}" data-notif-url="${esc(meta.url)}">
                <div class="wr-notif-icon">${meta.icon}</div>
                <div class="wr-notif-body">
                    <div class="wr-notif-text">${meta.text}</div>
                    <div class="wr-notif-time">${esc(timeAgo(n.created_at))}</div>
                </div>
            </div>
            `;
            }).join("");
            }

            p.innerHTML = `
            <div class="wr-bell-head">
                <h3>Notifications${unread ? ` (${unread})` : ""}</h3>
                <button type="button" data-notif-action="mark-all" ${unread ? "" : "disabled" }>
                    Mark all read
                </button>
            </div>
            <div class="wr-bell-body">
                ${bodyHtml}
            </div>
            <div class="wr-bell-foot">
                <a href="notifications.html">See all notifications →</a>
            </div>
            `;
            }

            async function fetchRecent(limit = 12) {
            if (!session) return [];
            const { data, error } = await sb.from("notifications")
            .select(`
            id, type, actor_id, target_type, target_id,
            context_type, context_id, snippet, is_read, created_at,
            actor:profiles!notifications_actor_id_fkey(id, username, avatar_url)
            `)
            .eq("user_id", session.user.id)
            .order("created_at", { ascending: false })
            .limit(limit);
            if (error) { console.error("notif fetch:", error); return []; }
            return data || [];
            }

            async function openPanel() {
            const p = getPanel();
            p.classList.add("open");
            positionPanel();
            p.innerHTML = `<div class="wr-notif-empty">Loading…</div>`;
            const items = await fetchRecent();
            renderPanel(items);
            positionPanel();
            }

            async function togglePanel() {
            const p = getPanel();
            if (p.classList.contains("open")) closePanel();
            else await openPanel();
            }

            /* ---------- Badge ---------- */
            function updateBadge() {
            const badge = document.querySelector(".wr-bell-badge");
            if (!badge) return;
            if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
            badge.classList.add("show");
            } else {
            badge.classList.remove("show");
            }
            }

            async function refreshUnreadCount() {
            if (!session) {
            unreadCount = 0;
            updateBadge();
            return;
            }
            const { data, error } = await sb.rpc("get_unread_notification_count");
            if (error) { console.warn("unread count:", error); return; }
            unreadCount = data || 0;
            updateBadge();
            }

            /* ---------- Realtime ---------- */
            function subscribeToNotifications(userId) {
            if (subscribedUserId === userId && notifChannel) return;
            if (notifChannel) { notifChannel.unsubscribe(); notifChannel = null; }
            subscribedUserId = userId;

            notifChannel = sb.channel("notif-" + userId)
            .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: "user_id=eq." + userId
            }, () => {
            unreadCount += 1;
            updateBadge();
            const p = getPanel();
            if (p.classList.contains("open")) {
            fetchRecent().then(renderPanel).then(positionPanel);
            }
            })
            .subscribe();
            }

            function unsubscribeFromNotifications() {
            if (notifChannel) { notifChannel.unsubscribe(); notifChannel = null; }
            subscribedUserId = null;
            }

            /* ---------- Header render ---------- */
            function render(sess, profile) {
            session = sess;
            cached = profile;

            const area = getArea();
            if (!area) return;

            if (sess && profile) {
            area.innerHTML = `
            <a class="wr-auth-user" href="profile.html" title="Your profile">
                ${esc(profile.username)}
            </a>
            <button class="wr-bell" type="button" aria-label="Notifications">
                🔔<span class="wr-bell-badge" id="wr-bell-badge"></span>
            </button>
            <a class="wr-auth-settings" href="settings.html" title="Settings">⚙️</a>
            <button class="wr-auth-logout" type="button" id="wr-logout-btn">Logout</button>
            `;
            const logout = document.getElementById("wr-logout-btn");
            if (logout) logout.addEventListener("click", async () => {
            unsubscribeFromNotifications();
            await sb.auth.signOut();
            window.location.reload();
            });

            updateBadge();
            refreshUnreadCount();
            subscribeToNotifications(sess.user.id);
            } else {
            // Session exists but profile is missing — e.g. account was deleted.
            // Sign out cleanly so the header doesn't loop between ghost state and CTAs.
            if (sess && !profile) {
            sb.auth.signOut().catch(() => {});
            }
            unsubscribeFromNotifications();
            closePanel();
            area.innerHTML = `
            <a class="wr-auth-signin wr-auth-cta" href="login.html">Sign in</a>
            <a class="wr-auth-join wr-auth-cta" href="signup.html">Join</a>
            `;
            }
            }

            /* ---------- Data ---------- */
            async function fetchProfile(userId) {
            const { data, error } = await sb.from("profiles")
            .select("id, username, rank, bio, country, avatar_url")
            .eq("id", userId)
            .maybeSingle();
            if (error) { console.warn("profile fetch:", error); return null; }
            return data;
            }

            async function refresh() {
            const { data: { session: s } } = await sb.auth.getSession();
            let profile = null;
            if (s?.user) {
            profile = await fetchProfile(s.user.id);
            }
            render(s, profile);
            }

            sb.auth.onAuthStateChange(() => { refresh(); });

            if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", refresh);
            } else {
            refresh();
            }

            /* ---------- Global click delegation ---------- */
            document.addEventListener("click", async (e) => {
            // Bell toggle
            const bell = e.target.closest(".wr-bell");
            if (bell) {
            e.preventDefault(); e.stopPropagation();
            togglePanel();
            return;
            }

            // Mark all read
            const markAll = e.target.closest("[data-notif-action='mark-all']");
            if (markAll) {
            e.preventDefault(); e.stopPropagation();
            markAll.disabled = true;
            const { error } = await sb.rpc("mark_all_notifications_read");
            if (!error) {
            unreadCount = 0;
            updateBadge();
            fetchRecent().then(renderPanel).then(positionPanel);
            }
            return;
            }

            // Notification row click
            const notifRow = e.target.closest(".wr-notif-row");
            if (notifRow) {
            e.preventDefault();
            const id = notifRow.dataset.notifId;
            const url = notifRow.dataset.notifUrl;
            if (id) sb.rpc("mark_notification_read", { p_notification_id: id }).catch(() => {});
            closePanel();
            if (url && url !== "#") window.location.href = url;
            return;
            }

            // Click outside panel closes it
            const p = getPanel();
            if (p.classList.contains("open") &&
            !e.target.closest(".wr-bell-panel") &&
            !e.target.closest(".wr-bell")) {
            closePanel();
            }
            });

            window.addEventListener("resize", () => {
            const p = getPanel();
            if (p.classList.contains("open")) positionPanel();
            });

            /* ---------- Public API ---------- */
            window.wr = {
            sb,
            turnstileSiteKey: "0x4AAAAAAE-T6yl4RUNhYl0a",
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
            async signOut() { await sb.auth.signOut(); },
            refreshUnreadCount,
            openNotifications: openPanel,
            closeNotifications: closePanel
            };
            })();
