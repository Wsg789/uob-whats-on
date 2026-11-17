// whatson: student nights page. Reads NIGHTS and NIGHTS_META from nights.js (replaced weekly).
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var DAY_MS = 86400000;
  var AREAS = { all: "All areas", selly: "Selly Oak & campus", broad: "Broad Street", digbeth: "Digbeth & city", trip: "Out of Birmingham" };
  var PIN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>';

  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function dateOf(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function longDate(d) { return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }); }

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var todayIso = iso(today), tomorrowIso = iso(new Date(today.getTime() + DAY_MS + 3600000));
  var weekEnd = iso(new Date(today.getTime() + 6 * DAY_MS + 3600000));
  var nights = NIGHTS.filter(function (n) { return n.d >= todayIso; })
    .sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : a.t < b.t ? -1 : a.t > b.t ? 1 : 0; });

  var KINDS = { all: "All nights", club: "Clubs & promoters", soc: "Society nights" };
  var state = { area: "all", kind: "all" };
  try { var saved = localStorage.getItem("whatson.area"); if (AREAS[saved]) state.area = saved; } catch (e) {}
  function kindOk(x, k) { return k === "all" || (k === "soc") === !!x.soc; }
  function areaOk(x, k) { return k === "all" || x.a === k; }

  function renderKinds() {
    var box = $("kinds"); box.innerHTML = "";
    Object.keys(KINDS).forEach(function (k) {
      var n = nights.filter(function (x) { return kindOk(x, k) && areaOk(x, state.area); }).length;
      var b = document.createElement("button");
      b.type = "button"; b.className = "seg"; b.setAttribute("aria-pressed", String(state.kind === k));
      b.textContent = KINDS[k] + " (" + n + ")";
      b.onclick = function () { state.kind = k; render(); };
      box.appendChild(b);
    });
  }

  function renderChips() {
    var box = $("areas"); box.innerHTML = "";
    Object.keys(AREAS).forEach(function (k) {
      var n = nights.filter(function (x) { return areaOk(x, k) && kindOk(x, state.kind); }).length;
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.setAttribute("aria-pressed", String(state.area === k));
      b.innerHTML = "<span></span><b></b>";
      b.firstChild.textContent = AREAS[k]; b.lastChild.textContent = n;
      if (!n) b.disabled = true;
      b.onclick = function () { state.area = k; try { localStorage.setItem("whatson.area", k); } catch (e) {} render(); };
      box.appendChild(b);
    });
  }

  // venue plus area, unless the venue already names the area (e.g. "Rosie's, Broad Street")
  var AREA_WORDS = { selly: /selly oak/i, broad: /broad st/i, digbeth: /digbeth/i, trip: /^$/ };
  function place(n) {
    return AREA_WORDS[n.a] && AREA_WORDS[n.a].test(n.v) ? n.v : n.v + " · " + AREAS[n.a];
  }

  function row(n) {
    var el = document.createElement("article");
    el.className = "ev night";
    el.innerHTML =
      '<div class="ev-time"><b></b><span></span></div>' +
      '<div class="ev-main"><h3 class="ev-title"></h3><div class="ev-soc"></div><div class="ev-loc">' + PIN + '<span></span></div></div>' +
      '<div class="night-buy"><span class="price"></span><a class="ticket-btn" target="_blank" rel="noopener"></a></div>';
    var tb = el.querySelector(".ev-time b");
    tb.textContent = n.t === "TBC" ? "Time TBC" : n.t;
    if (n.t === "TBC") tb.className = "tbc";
    el.querySelector(".ev-time span").textContent = n.e ? "until " + n.e : "";
    var h = el.querySelector(".ev-title"); h.textContent = n.n;
    [n.soc ? "Society" : "", n.tag || ""].forEach(function (label) {
      if (!label) return;
      var t = document.createElement("span"); t.className = label === "Society" ? "tag soc" : "tag"; t.textContent = label; h.appendChild(t);
    });
    var by = el.querySelector(".ev-soc");
    if (n.soc) {
      var s = document.createElement("a"); s.target = "_blank"; s.rel = "noopener";
      s.href = "https://www.instagram.com/" + n.h + "/"; s.textContent = n.by;
      by.appendChild(s);
    } else by.textContent = "by " + n.by;
    el.querySelector(".ev-loc span").textContent = place(n);
    el.querySelector(".price").textContent = n.p;
    var a = el.querySelector(".ticket-btn");
    a.href = n.url || "https://www.instagram.com/" + n.h + "/";
    a.textContent = n.b || (n.url ? (/guildofstudents/.test(n.url) ? "Guild page" : "Tickets") : "Society post");
    if (n.b) a.classList.add("quiet");
    if (!n.url) a.classList.add("quiet");
    a.setAttribute("aria-label", a.textContent + " for " + n.n + " (opens a new tab)");
    return el;
  }

  function render() {
    renderKinds();
    renderChips();
    var rows = nights.filter(function (n) { return areaOk(n, state.area) && kindOk(n, state.kind); });
    var list = $("list"); list.innerHTML = "";
    if (!rows.length) {
      list.innerHTML = '<div class="empty"><b>No student nights listed here yet</b><span>Try another area.</span></div>';
      return;
    }
    var cur = null, laterShown = false;
    rows.forEach(function (n) {
      if (n.d > weekEnd && !laterShown) {
        laterShown = true;
        var sep = document.createElement("div"); sep.className = "later-head"; sep.textContent = "Later";
        list.appendChild(sep);
      }
      if (n.d !== cur) {
        cur = n.d;
        var c = rows.filter(function (r) { return r.d === cur; }).length;
        var head = document.createElement("div"); head.className = "day-head";
        head.innerHTML = "<h2></h2><span></span>";
        var label = longDate(dateOf(cur));
        if (cur === todayIso) label = "Tonight, " + label;
        else if (cur === tomorrowIso) label = "Tomorrow, " + label;
        head.firstChild.textContent = label;
        head.lastChild.textContent = c + (c === 1 ? " night" : " nights");
        list.appendChild(head);
      }
      list.appendChild(row(n));
    });
  }

  var nWeek = nights.filter(function (n) { return n.d <= weekEnd; }).length;
  $("eyebrow").textContent = longDate(today);
  $("lede").textContent = nWeek + " student nights over the next seven days, from " + NIGHTS_META.sources + ".";
  $("updated").textContent = "List updated " + NIGHTS_META.updated + ".";
  render();
})();
