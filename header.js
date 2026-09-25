/* The Whacky Rack — standard header navigation for all pages */
(function () {
  var header = document.querySelector("header");
  if (!header) return;

  var inner = header.querySelector(".header-inner");
  if (!inner) return;

  var path = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (path === "") path = "index.html";

  var links = [
    { href: "index.html",         label: "Shop",     active: ["index.html", ""] },
    { href: "world.html",         label: "World",    active: ["world.html"] },
    { href: "history.html",       label: "History",  active: ["history.html"] },
    { href: "yap.html",           label: "Yap it!",  active: ["yap.html", "yap-thread.html"] },
    { href: "tape.html",          label: "Tape it!", active: ["tape.html", "tape-thread.html"] },
    { href: "search-users.html",  label: "People",   active: ["search-users.html"] },
    { href: "about.html",         label: "About",    active: ["about.html"] }
  ];

  var html = '<a href="index.html" class="logo">The <span>Whacky</span> Rack</a>';
  html += '<div class="header-right">';

  for (var i = 0; i < links.length; i++) {
    var l = links[i];
    var isActive = l.active.indexOf(path) !== -1;
    html += '<a href="' + l.href + '" class="nav-link' + (isActive ? ' active' : '') + '">' + l.label + '</a>';
  }

  html += '</div>';

  inner.innerHTML = html;
})();
