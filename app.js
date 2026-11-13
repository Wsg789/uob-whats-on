// whatson — listing page. Reads EVENTS and META from events.js (replaced weekly).
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var DAY_MS = 86400000;
  var ICON = {
    pin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    cal: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/></svg>',
    link: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>'
  };

  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function dateOf(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function hasLoc(l) { return !/^(not specified|tbc|location by dm|sent to whatsapp|see the society)/i.test(l) && !/room tbc/i.test(l); }
  function parseTime(t) {
    var m = /^(\d{1,2}):(\d{2})(?:\s*-\s*(\d{1,2}):(\d{2}))?\s*(.*)$/.exec(t);
    if (!m) return { label: t, start: null, end: null, note: "" };
    var start = +m[1] * 60 + +m[2];
    var end = m[3] ? +m[3] * 60 + +m[4] : null;
    var note = m[5].replace(/^\(|\)$/g, "");
    if (end !== null) note = "until " + m[3].padStart(2, "0") + ":" + m[4] + (note ? ", " + note : "");
    return { label: m[1].padStart(2, "0") + ":" + m[2], start: start, end: end, note: note };
  }

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var todayIso = iso(today);
  var events = EVENTS.map(function (e, i) {
    var t = parseTime(e.t);
    return { id: "e" + i, d: e.d, date: dateOf(e.d), time: t, soc: e.s, name: e.e, loc: e.l, hasLoc: hasLoc(e.l), handle: e.h };
  }).filter(function (e) { return e.date >= today; })
    .sort(function (a, b) { return a.date - b.date || (a.time.start === null ? 9999 : a.time.start) - (b.time.start === null ? 9999 : b.time.start); });

  var week = [];
  for (var i = 0; i < 7; i++) week.push(iso(new Date(today.getTime() + i * DAY_MS + 3600000)));
  var state = { day: todayIso, q: "", room: false };
  try { state.room = localStorage.getItem("whatson.room") === "1"; } catch (e) {}
  var hash = location.hash.slice(1);
  if (hash === "later" || week.indexOf(hash) > -1) state.day = hash;
  else if (!events.some(function (e) { return e.d === todayIso; })) {
    var next = events[0];
    if (next) state.day = week.indexOf(next.d) > -1 ? next.d : "later";
  }

  function count(day) { return events.filter(function (e) { return day === "later" ? week.indexOf(e.d) === -1 : e.d === day; }).length; }
  function longDate(d) { return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }); }
  function dayName(s) {
    if (s === todayIso) return "Today";
    if (s === week[1]) return "Tomorrow";
    return dateOf(s).toLocaleDateString("en-GB", { weekday: "long" });
  }

  function renderDays() {
    var box = $("days"); box.innerHTML = "";
    week.concat(["later"]).forEach(function (d, i) {
      var n = count(d);
      var b = document.createElement("button");
      b.type = "button"; b.className = "day-btn"; b.setAttribute("aria-pressed", String(state.day === d && !state.q));
      var top = d === "later" ? "Later" : i === 0 ? "Today" : dateOf(d).toLocaleDateString("en-GB", { weekday: "short" });
      var sub = d === "later" ? n + " listed" : dateOf(d).getDate() + " · " + n;
      b.innerHTML = "<b></b><span></span>";
      b.firstChild.textContent = top; b.lastChild.textContent = sub;
      b.setAttribute("aria-label", (d === "later" ? "Later" : longDate(dateOf(d))) + ", " + n + " events");
      if (!n) b.disabled = true;
      b.onclick = function () { state.day = d; state.q = ""; $("q").value = ""; history.replaceState(null, "", "#" + d); render(); };
      box.appendChild(b);
    });
  }

  function row(e) {
    var el = document.createElement("article");
    el.className = "ev"; el.id = e.id;
    var now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
    var live = false;
    if (e.d === todayIso && e.time.start !== null) {
      var end = e.time.end !== null ? e.time.end : e.time.start + 120;
      if (mins >= e.time.start && mins < end) live = true;
      else if (mins >= end) el.classList.add("done");
    }
    el.innerHTML =
      '<div class="ev-time"><b></b><span></span></div>' +
      '<div class="ev-main"><h3 class="ev-title"></h3><div class="ev-soc"><a target="_blank" rel="noopener"></a></div><div class="ev-loc">' + ICON.pin + "<span></span></div></div>" +
      '<div class="ev-acts"><button type="button" class="icon-btn" data-act="cal" title="Add to calendar" aria-label="Add to calendar">' + ICON.cal + '</button><button type="button" class="icon-btn" data-act="link" title="Copy link" aria-label="Copy link to this event">' + ICON.link + "</button></div>";
    var tb = el.querySelector(".ev-time b");
    tb.textContent = e.time.start === null ? (/^tbc$/i.test(e.time.label) ? "Time TBC" : e.time.label) : e.time.label;
    if (e.time.start === null) tb.className = "tbc";
    el.querySelector(".ev-time span").textContent = e.time.note;
    var h = el.querySelector(".ev-title"); h.textContent = e.name;
    if (live) { var bd = document.createElement("span"); bd.className = "badge"; bd.textContent = "On now"; h.appendChild(bd); }
    var a = el.querySelector(".ev-soc a"); a.textContent = e.soc; a.href = "https://www.instagram.com/" + e.handle + "/";
    var loc = el.querySelector(".ev-loc");
    if (e.hasLoc) loc.lastChild.textContent = e.loc;
    else { loc.classList.add("none"); loc.lastChild.textContent = "Room not announced. Check the society's Instagram."; }
    if (e.time.start === null) el.querySelector('[data-act="cal"]').hidden = true;
    el.querySelector(".ev-acts").onclick = function (ev) {
      var btn = ev.target.closest("button"); if (!btn) return;
      if (btn.dataset.act === "cal") downloadIcs(e); else copyLink(e);
    };
    return el;
  }

  function render() {
    renderDays();
    var q = state.q.trim().toLowerCase();
    var rows = events.filter(function (e) {
      if (state.room && !e.hasLoc) return false;
      if (q) return (e.soc + " " + e.name + " " + e.loc + " " + e.handle).toLowerCase().indexOf(q) > -1;
      return state.day === "later" ? week.indexOf(e.d) === -1 : e.d === state.day;
    });
    var list = $("list"); list.innerHTML = "";
    if (!rows.length) {
      list.innerHTML = '<div class="empty"><b></b><span></span></div>';
      list.querySelector("b").textContent = q ? "Nothing matches “" + state.q.trim() + "”" : "Nothing listed for this day yet";
      list.querySelector("span").textContent = q ? "Try a society name, a building or a type of event." : "Societies often announce a day or two ahead. Try another day.";
      return;
    }
    var cur = null;
    rows.forEach(function (e) {
      if (e.d !== cur) {
        cur = e.d;
        var n = rows.filter(function (r) { return r.d === cur; }).length;
        var head = document.createElement("div"); head.className = "day-head";
        head.innerHTML = "<h2></h2><span></span>";
        head.firstChild.textContent = week.indexOf(cur) > -1 && week.indexOf(cur) < 2 ? dayName(cur) + ", " + dateOf(cur).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : longDate(dateOf(cur));
        head.lastChild.textContent = n + (n === 1 ? " event" : " events");
        list.appendChild(head);
      }
      list.appendChild(row(e));
    });
  }

  function toast(msg) {
    var t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2200);
  }
  function copyLink(e) {
    var url = location.origin + location.pathname + "#" + e.d;
    var text = e.name + " – " + e.soc + ", " + longDate(e.date) + (e.time.start !== null ? " at " + e.time.label : "") + (e.hasLoc ? ", " + e.loc : "") + "\n" + url;
    if (navigator.share && matchMedia("(pointer: coarse)").matches) { navigator.share({ title: e.name, text: text }).catch(function () {}); return; }
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast("Copied to clipboard"); }, function () { toast("Could not copy. Long-press the event to select it."); });
  }
  function downloadIcs(e) {
    function stamp(mins) { return e.d.replace(/-/g, "") + "T" + String(Math.floor(mins / 60) % 24).padStart(2, "0") + String(mins % 60).padStart(2, "0") + "00"; }
    function esc(s) { return s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n"); }
    var end = e.time.end !== null && e.time.end > e.time.start ? e.time.end : Math.min(e.time.start + 120, 1439);
    var ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//whatson//EN", "BEGIN:VEVENT",
      "UID:" + e.d + "-" + e.id + "@whatson", "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z",
      "DTSTART;TZID=Europe/London:" + stamp(e.time.start), "DTEND;TZID=Europe/London:" + stamp(end),
      "SUMMARY:" + esc(e.name + " (" + e.soc + ")"), e.hasLoc ? "LOCATION:" + esc(e.loc) : "",
      "DESCRIPTION:" + esc("Listed on whatson. Check the society's Instagram before you go: https://www.instagram.com/" + e.handle + "/"),
      "END:VEVENT", "END:VCALENDAR"].filter(Boolean).join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = e.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) + ".ics";
    document.body.appendChild(a); a.click(); a.remove();
  }

  // intro line
  var nToday = count(todayIso), nWeek = events.filter(function (e) { return week.indexOf(e.d) > -1; }).length;
  $("eyebrow").textContent = longDate(today);
  $("lede").textContent = (nToday ? nToday + (nToday === 1 ? " event" : " events") + " today and " : "") + nWeek + " over the next seven days, from " + META.accounts + " University of Birmingham society accounts.";
  $("updated").textContent = "List updated " + META.updated + ".";

  $("q").addEventListener("input", function (ev) { state.q = ev.target.value; render(); });
  $("room").checked = state.room;
  $("room").addEventListener("change", function (ev) { state.room = ev.target.checked; try { localStorage.setItem("whatson.room", state.room ? "1" : "0"); } catch (e) {} render(); });
  render();
})();
