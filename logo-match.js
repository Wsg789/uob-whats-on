// whatson: finds the small logos shown beside each listing. Reads SOCIETY_LOGOS and NIGHT_LOGOS from logos.js.
// Societies: the event's own Instagram handle first, then every other Guild society named in a collab
// ("Kickboxing Society x Judo", "Sikh Society (with Punjabi Society)"), matched by name. Up to 4 logos.
// Nights: the promoter's logo, else the venue's.
(function () {
  "use strict";
  var socs = typeof SOCIETY_LOGOS !== "undefined" ? SOCIETY_LOGOS : [];
  var nights = typeof NIGHT_LOGOS !== "undefined" ? NIGHT_LOGOS : {};
  function norm(s) {
    return (" " + s.toLowerCase().replace(/&/g, " and ") + " ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/ (uob|university of birmingham|university|birmingham|bham|society|soc|club|the|of) /g, " ")
      .replace(/ (uob|university|birmingham|society|soc|club|the|of) /g, " ")
      .replace(/\s+/g, " ").trim();
  }
  // short names as they appear in posts -> Instagram handle, where neither the Guild name nor the handle gives it away
  var ALIAS = { bifs: "uobifs" };
  // "FemSoc" / @uobfemsoc -> "fem", "Amnesty" / @uob.amnesty -> "amnesty"
  function compact(s) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^(uob|bham|birmingham)+/, "").replace(/(society|soc|official|uob|bham)+$/, "");
  }
  var byHandle = {}, byName = {}, byShort = {};
  socs.forEach(function (s) {
    if (s.h && !byHandle[s.h]) byHandle[s.h] = s;
    var k = norm(s.n);
    if (k && !byName[k]) byName[k] = s;
    var c = s.h ? compact(s.h) : "";
    if (c.length >= 3 && !byShort[c]) byShort[c] = s;
  });
  function lookup(seg) {
    var a = ALIAS[seg.toLowerCase().replace(/[^a-z0-9]/g, "")];
    if (a && byHandle[a]) return byHandle[a];
    if (byName[norm(seg)]) return byName[norm(seg)];
    var c = compact(seg);
    return c.length >= 3 && seg.split(/\s+/).length <= 2 ? byShort[c] : null;
  }

  function forSociety(name, handle) {
    var out = [], seen = {};
    function add(s) { if (s && !seen[s.f] && out.length < 4) { seen[s.f] = true; out.push(s); } }
    add(byHandle[(handle || "").toLowerCase()]);
    (name || "").split(/\s+x\s+|[(),;]|\s+\+\s+/i).forEach(function (seg) {
      seg = seg.replace(/^\s*(with|and)\s+/i, "").trim();
      if (!seg) return;
      var hit = lookup(seg);
      if (hit) { add(hit); return; }
      if (/\s&\s|\sand\s/i.test(seg)) seg.split(/\s+&\s+|\s+and\s+/i).forEach(function (p) { add(lookup(p)); });
    });
    return out.map(function (s) { return { src: s.f, name: s.n }; });
  }
  function forNight(by, venue) {
    var v = (venue || "").split(",")[0].trim(), f = nights[by] || nights[v];
    if (!f && v) Object.keys(nights).some(function (k) { if (k.toLowerCase().indexOf(v.toLowerCase()) === 0) { f = nights[k]; return true; } return false; });
    return f ? [{ src: f, name: by || v }] : [];
  }
  function html(list) {
    if (!list.length) return "";
    return '<span class="logos" aria-hidden="true">' + list.map(function (l) {
      return '<img src="' + l.src + '" alt="" width="24" height="24" loading="lazy" decoding="async">';
    }).join("") + "</span>";
  }
  window.whatsonLogos = { forSociety: forSociety, forNight: forNight, html: html };
})();
