// whatson: listing page. Reads EVENTS and META from events.js (replaced every Monday).
// Layout and interaction from the Gemini 4 Argon design (18 Nov 2026); dates, live state and calendar links use the real clock.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var els = { eyebrow: $("eyebrow"), lede: $("lede"), updated: $("updated"), days: $("days"), q: $("q"), clearQ: $("clear-q"), room: $("room"), list: $("list"), toast: $("toast") };

  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function dateOf(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = dateOf(s); d.setDate(d.getDate() + n); return iso(d); }
  function longDate(s) { return dateOf(s).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }); }
  function shortDay(s) { return dateOf(s).toLocaleDateString("en-GB", { weekday: "short" }); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40); }
  function hhmm(m) { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
  function nowMins() { var n = new Date(); return n.getHours() * 60 + n.getMinutes(); }

  // "19:00-21:00", "19:30 (doors 19:00)", "17:30 or 18:00", "TBC" ...
  function parseTime(t) {
    t = (t || "").trim();
    var m = /^(\d{1,2}):(\d{2})(?:\s*-\s*(\d{1,2}):(\d{2}))?\s*(?:\(([^)]*)\))?$/.exec(t);
    if (m) {
      var start = +m[1] * 60 + +m[2], end = null, sub = [];
      if (m[3] !== undefined) { end = +m[3] * 60 + +m[4]; if (end <= start) end += 1440; sub.push("until " + hhmm(end)); }
      if (m[5]) sub.push(m[5]);
      return { tbc: false, start: start, end: end, main: hhmm(start), sub: sub.join(" · ") };
    }
    var f = /(\d{1,2}):(\d{2})/.exec(t);
    if (f) {
      var s = +f[1] * 60 + +f[2];
      return { tbc: false, start: s, end: null, main: hhmm(s), sub: t.replace(f[0], "").trim().replace(/^\(|\)$/g, "") };
    }
    return { tbc: true, start: null, end: null, main: /^tbc$/i.test(t) || !t ? "Time TBC" : t, sub: "" };
  }
  function hasRoom(l) { return !/^(not specified|tbc|online|location by dm|location in |dm |sent to whatsapp|see the society)/i.test(l) && !/room tbc|group ?chat|whatsapp/i.test(l); }
  function notAnnounced(l) { return /^(not specified|tbc)$/i.test(l.trim()); }
  function endMins(e) { return e.time.end !== null ? e.time.end : e.time.start + 120; }

  // ---------- data ----------
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var todayIso = iso(today);
  var week = [];
  for (var i = 0; i < 7; i++) week.push(addDays(todayIso, i));
  var lastDay = week[6];
  var seen = {};
  var events = EVENTS.filter(function (e) { return e.d >= todayIso; }).map(function (e) {
    var id = "ev-" + e.d + "-" + slug(e.s) + "-" + slug(e.e), n = 2;
    while (seen[id]) id = id.replace(/-\d+$/, "") + "-" + n++;
    seen[id] = true;
    var s = e.s.trim(), name = e.e.trim(), l = e.l.trim();
    return { id: id, d: e.d, time: parseTime(e.t), soc: s, name: name, loc: l, room: hasRoom(l), handle: e.h,
      blob: (s + " " + name + " " + l + " @" + e.h).toLowerCase() };
  }).sort(function (a, b) {
    return a.d < b.d ? -1 : a.d > b.d ? 1 : (a.time.tbc ? 9999 : a.time.start) - (b.time.tbc ? 9999 : b.time.start) || a.soc.localeCompare(b.soc);
  });

  var state = { day: todayIso, q: "", room: false, menu: null, target: null };
  try { state.room = localStorage.getItem("whatson.room") === "1"; } catch (e) {}
  els.room.checked = state.room;
  function inDay(e, day) { return day === "later" ? e.d > lastDay : e.d === day; }
  function count(day) { return events.filter(function (e) { return inDay(e, day) && (!state.room || e.room); }).length; }
  if (!events.some(function (e) { return e.d === todayIso; })) {
    var next = events[0];
    if (next) state.day = next.d > lastDay ? "later" : next.d;
  }

  function status(e, mins) {
    if (e.d !== todayIso || e.time.tbc) return "";
    if (mins >= e.time.start && mins < endMins(e)) return "live";
    if (mins >= endMins(e)) return "done";
    return "";
  }

  // ---------- header ----------
  function renderSummary() {
    var mins = nowMins();
    var todays = events.filter(function (e) { return e.d === todayIso; });
    var live = todays.filter(function (e) { return status(e, mins) === "live"; }).length;
    var nWeek = events.filter(function (e) { return e.d <= lastDay; }).length;
    els.eyebrow.textContent = longDate(todayIso);
    els.lede.innerHTML = (todays.length ? todays.length + (todays.length === 1 ? " event" : " events") + " today" +
      (live ? ' (<span class="intro-live">' + live + " on now</span>)" : "") + " and " : "") +
      nWeek + " over the next seven days, from " + META.accounts + " " + (META.uni || "University of Birmingham") + " society accounts.";
    els.updated.textContent = "List updated " + META.updated + ".";
  }

  // ---------- day rail ----------
  function renderDays() {
    var searching = !!state.q.trim();
    els.days.innerHTML = week.concat(["later"]).map(function (k, idx) {
      var n = count(k), pressed = !searching && state.day === k;
      var top = k === "later" ? "From " + dateOf(addDays(lastDay, 1)).getDate() + " " + dateOf(addDays(lastDay, 1)).toLocaleDateString("en-GB", { month: "short" }) : idx === 0 ? "Today" : shortDay(k);
      var num = k === "later" ? "Later" : String(dateOf(k).getDate());
      var label = (k === "later" ? "Later" : longDate(k)) + ", " + n + (n === 1 ? " event" : " events");
      return '<button type="button" class="day-btn" data-day="' + k + '" aria-pressed="' + pressed + '" aria-label="' + esc(label) + '"' + (!n && !pressed ? " disabled" : "") + ">" +
        '<span class="d-top">' + esc(top) + '</span><span class="d-row"><span class="d-num">' + esc(num) + '</span><span class="d-cnt">' + n + "</span></span></button>";
    }).join("");
  }

  // ---------- calendar links (UK time) ----------
  function stamp(e, mins, dashed) {
    var day = mins >= 1440 ? addDays(e.d, 1) : e.d, t = hhmm(mins);
    return dashed ? day + "T" + t + ":00" : day.replace(/-/g, "") + "T" + t.replace(":", "") + "00";
  }
  function calTitle(e) { return e.name + " (" + e.soc + ")"; }
  function calNote(e) { return "Listed on whatson. Check the society's Instagram before you go: https://www.instagram.com/" + e.handle + "/"; }
  function googleUrl(e) {
    var enc = encodeURIComponent, dates = e.time.tbc
      ? e.d.replace(/-/g, "") + "/" + addDays(e.d, 1).replace(/-/g, "")
      : stamp(e, e.time.start) + "/" + stamp(e, endMins(e));
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + enc(calTitle(e)) + "&dates=" + dates +
      "&ctz=Europe/London" + (e.room ? "&location=" + enc(e.loc) : "") + "&details=" + enc(calNote(e));
  }
  function outlookUrl(e) {
    var enc = encodeURIComponent, when = e.time.tbc
      ? "&allday=true&startdt=" + e.d + "&enddt=" + addDays(e.d, 1)
      : "&startdt=" + enc(stamp(e, e.time.start, true)) + "&enddt=" + enc(stamp(e, endMins(e), true));
    return "https://outlook.office.com/calendar/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=" + enc(calTitle(e)) +
      when + (e.room ? "&location=" + enc(e.loc) : "") + "&body=" + enc(calNote(e));
  }
  function downloadIcs(e) {
    function x(s) { return s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n"); }
    var when = e.time.tbc
      ? ["DTSTART;VALUE=DATE:" + e.d.replace(/-/g, ""), "DTEND;VALUE=DATE:" + addDays(e.d, 1).replace(/-/g, "")]
      : ["DTSTART;TZID=Europe/London:" + stamp(e, e.time.start), "DTEND;TZID=Europe/London:" + stamp(e, endMins(e))];
    var ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//whatson//EN", "BEGIN:VEVENT", "UID:" + e.id + "@uobwhatson.co.uk",
      "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"].concat(when, [
      "SUMMARY:" + x(calTitle(e)), e.room ? "LOCATION:" + x(e.loc) : "", "DESCRIPTION:" + x(calNote(e)), "END:VEVENT", "END:VCALENDAR"])
      .filter(Boolean).join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = slug(e.name) + ".ics";
    document.body.appendChild(a); a.click(); a.remove();
    toast("Calendar file saved. Open it to add the event.");
  }

  // ---------- rows ----------
  var PIN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 5.5-8 12-8 12s-8-6.5-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/></svg>';
  var INFO = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4m0 4h.01"/></svg>';
  var CAL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/></svg>';
  var LINK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

  function row(e, mins) {
    var st = status(e, mins), open = state.menu === e.id;
    var cls = "ev" + (st === "live" ? " is-live" : st === "done" ? " done" : "") + (open ? " menu-open" : "") + (state.target === e.id ? " is-target" : "");
    var loc = e.room ? e.loc : notAnnounced(e.loc) ? "Room not announced. Check the society's Instagram." : e.loc;
    var menu = open ? '<div class="cal-menu" role="menu" aria-label="Add to calendar"><p>Add to calendar</p>' +
      '<a role="menuitem" href="' + esc(googleUrl(e)) + '" target="_blank" rel="noopener" data-close>Google Calendar <span>↗</span></a>' +
      '<a role="menuitem" href="' + esc(outlookUrl(e)) + '" target="_blank" rel="noopener" data-close>Outlook (uni account) <span>↗</span></a>' +
      '<button type="button" role="menuitem" data-ics="' + esc(e.id) + '">Apple or other <span>.ics</span></button></div>' : "";
    return '<article class="' + cls + '" id="' + esc(e.id) + '">' +
      '<div class="ev-time"><b' + (e.time.tbc ? ' class="tbc"' : "") + ">" + esc(e.time.main) + "</b>" + (e.time.sub ? "<span>" + esc(e.time.sub) + "</span>" : "") + "</div>" +
      '<div class="ev-body"><h3 class="ev-title">' + esc(e.name) + (st === "live" ? '<span class="badge-live"><i aria-hidden="true"></i>On now</span>' : "") + "</h3>" +
      '<div class="ev-soc">' + (window.whatsonLogos ? whatsonLogos.html(whatsonLogos.forSociety(e.soc, e.handle)) : "") +
      '<a href="https://www.instagram.com/' + encodeURIComponent(e.handle) + '/" target="_blank" rel="noopener" title="@' + esc(e.handle) + ' on Instagram">' +
      esc(e.soc) + '<span class="ig-arr" aria-hidden="true">↗</span></a></div></div>' +
      '<div class="ev-loc' + (e.room ? "" : " none") + '">' + (e.room ? PIN : INFO) + "<span>" + esc(loc) + "</span></div>" +
      '<div class="ev-acts"><button type="button" class="icon-btn" data-cal="' + esc(e.id) + '" aria-label="Add ' + esc(e.name) + ' to calendar" aria-haspopup="menu" aria-expanded="' + open + '" title="Add to calendar">' + CAL + "</button>" +
      '<button type="button" class="icon-btn" data-copy="' + esc(e.id) + '" aria-label="Copy link to ' + esc(e.name) + '" title="Copy link to this event">' + LINK + "</button>" + menu + "</div></article>";
  }
  function dayHead(d, n) {
    var label = (d === todayIso ? "Today · " : d === week[1] ? "Tomorrow · " : "") + longDate(d);
    return '<div class="day-head"><h2>' + esc(label) + "</h2><span>" + n + (n === 1 ? " event" : " events") + "</span></div>";
  }

  function renderList() {
    var mins = nowMins(), q = state.q.trim().toLowerCase();
    var rows = events.filter(function (e) {
      if (state.room && !e.room) return false;
      if (q) return q.split(/\s+/).every(function (w) { return e.blob.indexOf(w) > -1; });
      return inDay(e, state.day);
    });
    if (!rows.length) {
      var why = q ? "Nothing coming up matches “" + esc(state.q.trim()) + "”" + (state.room ? " with a room." : ".")
        : state.room ? "No events with a room for this day yet." : "Societies often announce a day or two ahead. Try another day.";
      els.list.innerHTML = '<div class="empty"><b>' + (q ? "No matching events" : "Nothing listed yet") + "</b><span>" + why + "</span>" +
        (q || state.room ? '<button type="button" id="reset">Clear search and filter</button>' : "") + "</div>";
      return;
    }
    var html = q ? '<div class="search-banner">' + rows.length + (rows.length === 1 ? " event matches" : " events match") + ", from today onwards</div>" : "";
    var cur = null;
    rows.forEach(function (e) {
      if (e.d !== cur) { cur = e.d; html += dayHead(cur, rows.filter(function (r) { return r.d === cur; }).length); }
      html += row(e, mins);
    });
    els.list.innerHTML = html;
  }
  function render() { renderSummary(); renderDays(); renderList(); }

  // ---------- copy / share ----------
  var toastTimer;
  function toast(msg) {
    els.toast.textContent = msg; els.toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { els.toast.hidden = true; }, 2200);
  }
  function copyLink(e, btn) {
    var url = location.origin + location.pathname + "#" + e.id;
    var text = e.name + " – " + e.soc + ", " + longDate(e.d) + (e.time.tbc ? "" : " at " + e.time.main) + (e.room ? ", " + e.loc : "");
    if (navigator.share && matchMedia("(pointer: coarse)").matches) { navigator.share({ title: e.name, text: text, url: url }).catch(function () {}); return; }
    var done = function () { toast("Link copied"); btn.classList.add("copied"); setTimeout(function () { btn.classList.remove("copied"); }, 1200); };
    (navigator.clipboard ? navigator.clipboard.writeText(text + "\n" + url) : Promise.reject()).then(done, function () { toast("Could not copy. Long-press the event to select it."); });
  }

  // ---------- links into the page: #event-id, #YYYY-MM-DD or #later ----------
  function openHash() {
    var h = decodeURIComponent(location.hash.slice(1));
    if (!h) return;
    var e = events.filter(function (x) { return x.id === h; })[0];
    if (e) {
      if (state.room && !e.room) { state.room = false; els.room.checked = false; }
      state.day = e.d > lastDay ? "later" : e.d; state.target = e.id;
    } else if (h === "later" || week.indexOf(h) > -1) state.day = h;
    else return;
    state.q = ""; els.q.value = ""; els.clearQ.hidden = true;
    render();
    if (e) requestAnimationFrame(function () { var r = $(e.id); if (r) r.scrollIntoView({ block: "center" }); });
  }

  // ---------- events ----------
  els.days.addEventListener("click", function (ev) {
    var b = ev.target.closest(".day-btn"); if (!b || b.disabled) return;
    state.day = b.dataset.day; state.menu = null; state.target = null;
    state.q = ""; els.q.value = ""; els.clearQ.hidden = true;
    history.replaceState(null, "", "#" + state.day);
    render();
  });
  els.q.addEventListener("input", function () { state.q = els.q.value; state.menu = null; els.clearQ.hidden = !state.q; render(); });
  els.q.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && els.q.value) { ev.preventDefault(); els.clearQ.click(); } });
  els.clearQ.addEventListener("click", function () { els.q.value = ""; state.q = ""; els.clearQ.hidden = true; els.q.focus(); render(); });
  els.room.addEventListener("change", function () {
    state.room = els.room.checked; state.menu = null;
    try { localStorage.setItem("whatson.room", state.room ? "1" : "0"); } catch (e) {}
    render();
  });
  els.list.addEventListener("click", function (ev) {
    var t = ev.target;
    if (t.closest("#reset")) { state.q = ""; els.q.value = ""; els.clearQ.hidden = true; state.room = false; els.room.checked = false; try { localStorage.setItem("whatson.room", "0"); } catch (e) {} render(); return; }
    var cal = t.closest("[data-cal]");
    if (cal) { ev.stopPropagation(); state.menu = state.menu === cal.dataset.cal ? null : cal.dataset.cal; renderList(); return; }
    var ics = t.closest("[data-ics]");
    if (ics) { ev.stopPropagation(); var e1 = events.filter(function (x) { return x.id === ics.dataset.ics; })[0]; state.menu = null; renderList(); if (e1) downloadIcs(e1); return; }
    if (t.closest("[data-close]")) { setTimeout(function () { state.menu = null; renderList(); }, 0); return; }
    var cp = t.closest("[data-copy]");
    if (cp) { var e2 = events.filter(function (x) { return x.id === cp.dataset.copy; })[0]; if (e2) copyLink(e2, cp); }
  });
  document.addEventListener("click", function (ev) {
    if (state.menu && !ev.target.closest(".cal-menu") && !ev.target.closest("[data-cal]")) { state.menu = null; renderList(); }
  });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && state.menu) { state.menu = null; renderList(); } });
  window.addEventListener("hashchange", openHash);
  // keep "On now" and finished events current while the page stays open
  setInterval(function () { if (!state.menu) { renderSummary(); renderList(); } }, 60000);

  render();
  openHash();
})();

// University switcher in the header (Birmingham | Aston | Warwick)
(function () {
  var s = document.getElementById("uni");
  if (s) s.addEventListener("change", function () { if (s.value) location.href = s.value; });
})();
