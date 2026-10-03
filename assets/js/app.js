/* ============================================================
   野人遗产库 · Savage Legacy Archive
   Pure static SPA — hash routing, JSON data, no build step.
   ============================================================ */
(function () {
  "use strict";

  var RARITY_LABEL = {
    common: "普通", uncommon: "优良", rare: "稀有",
    epic: "史诗", legendary: "传说", mythic: "神话"
  };

  var DATA = null;
  var state = {
    view: "home",        // home | browse | detail
    category: "all",
    tag: null,
    query: "",
    sort: "default"
  };

  var el = {
    main:       document.getElementById("main"),
    catNav:     document.getElementById("categoryNav"),
    tagCloud:   document.getElementById("tagCloud"),
    search:     document.getElementById("searchInput"),
    sidebar:    document.getElementById("sidebar"),
    backdrop:   document.getElementById("backdrop"),
    menuToggle: document.getElementById("menuToggle"),
    randomBtn:  document.getElementById("randomBtn")
  };

  /* ---------- utilities ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function catOf(id) {
    return DATA.categories.find(function (c) { return c.id === id; })
        || { id: id, name: id, glyph: "◇", en: id };
  }

  function entryById(id) {
    return DATA.entries.find(function (e) { return e.id === id; });
  }

  function countCat(id) {
    if (id === "all") return DATA.entries.length;
    return DATA.entries.filter(function (e) { return e.category === id; }).length;
  }

  /* All tags with frequency, sorted */
  function allTags() {
    var map = {};
    DATA.entries.forEach(function (e) {
      (e.tags || []).forEach(function (t) { map[t] = (map[t] || 0) + 1; });
    });
    return Object.keys(map)
      .map(function (t) { return { tag: t, n: map[t] }; })
      .sort(function (a, b) { return b.n - a.n || a.tag.localeCompare(b.tag, "zh"); });
  }

  /* ---------- filtering ---------- */
  function filtered() {
    var q = state.query.trim().toLowerCase();
    var list = DATA.entries.slice();

    if (state.category !== "all") {
      list = list.filter(function (e) { return e.category === state.category; });
    }
    if (state.tag) {
      list = list.filter(function (e) { return (e.tags || []).indexOf(state.tag) > -1; });
    }
    if (q) {
      list = list.filter(function (e) {
        var hay = [
          e.name, e.en, e.desc, e.habitat, e.weakness,
          (e.tags || []).join(" "),
          catOf(e.category).name,
          (e.lore || []).join(" "),
          (e.drops || []).join(" ")
        ].join(" ").toLowerCase();
        return hay.indexOf(q) > -1;
      });
    }

    switch (state.sort) {
      case "name":
        list.sort(function (a, b) { return a.name.localeCompare(b.name, "zh"); });
        break;
      case "rarity":
        var order = ["mythic", "legendary", "epic", "rare", "uncommon", "common"];
        list.sort(function (a, b) {
          return order.indexOf(a.rarity) - order.indexOf(b.rarity);
        });
        break;
      case "category":
        list.sort(function (a, b) {
          return catOf(a.category).name.localeCompare(catOf(b.category).name, "zh");
        });
        break;
    }
    return list;
  }

  /* ---------- render: sidebar ---------- */
  function renderSidebar() {
    var html = "";
    html += navRow("all", "全部典藏", "📚", countCat("all"));
    DATA.categories.forEach(function (c) {
      html += navRow(c.id, c.name, c.glyph, countCat(c.id));
    });
    el.catNav.innerHTML = html;

    var tags = allTags();
    el.tagCloud.innerHTML = tags.slice(0, 22).map(function (t) {
      var active = state.tag === t.tag ? " active" : "";
      return '<span class="tag-chip' + active + '" data-tag="' + esc(t.tag) + '">' +
             esc(t.tag) + " " + t.n + "</span>";
    }).join("");
  }

  function navRow(id, name, glyph, count) {
    var active = (state.category === id && !state.tag) ? " active" : "";
    return '<div class="nav-item' + active + '" data-cat="' + esc(id) + '">' +
             '<span class="glyph">' + glyph + "</span>" +
             "<span>" + esc(name) + "</span>" +
             '<span class="count">' + count + "</span>" +
           "</div>";
  }

  /* ---------- render: card ---------- */
  function cardHTML(e, idx) {
    var c = catOf(e.category);
    var delay = Math.min(idx * 30, 400);
    return '<article class="card" data-id="' + esc(e.id) + '" data-rarity="' + esc(e.rarity) +
           '" style="animation-delay:' + delay + 'ms">' +
             '<div class="card-art"><span class="glyph">' + esc(e.glyph) + "</span></div>" +
             '<div class="card-body">' +
               '<h3 class="card-title">' + esc(e.name) + "</h3>" +
               '<div class="card-en">' + esc(e.en) + "</div>" +
               '<p class="card-desc">' + esc(e.desc) + "</p>" +
               '<div class="card-foot">' +
                 '<span class="rarity ' + esc(e.rarity) + '">' + (RARITY_LABEL[e.rarity] || e.rarity) + "</span>" +
                 '<span class="card-cat">' + c.glyph + " " + esc(c.name) + "</span>" +
               "</div>" +
             "</div>" +
           "</article>";
  }

  /* ---------- view: home ---------- */
  function viewHome() {
    var m = DATA.meta;
    var featured = DATA.entries
      .filter(function (e) { return e.rarity === "mythic" || e.rarity === "legendary"; })
      .slice(0, 6);

    var latest = DATA.entries.slice().reverse().slice(0, 8);

    var html = "";
    html += '<section class="hero">' +
      '<div class="hero-glyph">野</div>' +
      '<div class="eyebrow">The Savage Legacy Archive</div>' +
      "<h1>" + esc(m.title) + "</h1>" +
      "<p>" + esc(m.intro) + "</p>" +
      '<div class="hero-stats">' +
        stat(DATA.entries.length, "收录条目") +
        stat(DATA.categories.length, "典藏分类") +
        stat(allTags().length, "关联标签") +
        stat(featured.length + "+", "神话与传说") +
      "</div>" +
    "</section>";

    html += '<div class="section-head">' +
      "<div><h2>卷首 · 神话与传说</h2>" +
      '<div class="sub">凡被记入此卷者,皆已无可挽回</div></div>' +
      '<button class="clear-btn" data-goto="browse">浏览全部典藏 →</button>' +
    "</div>";
    html += '<div class="grid">' + featured.map(cardHTML).join("") + "</div>";

    html += '<div class="divider"><i>❖</i></div>';

    html += '<div class="section-head"><div><h2>近录 · 新增条目</h2>' +
      '<div class="sub">由历代测绘员陆续补录</div></div></div>';
    html += '<div class="grid">' + latest.map(cardHTML).join("") + "</div>";

    el.main.innerHTML = html;
  }

  function stat(num, lbl) {
    return '<div class="stat"><div class="num">' + num + '</div><div class="lbl">' + esc(lbl) + "</div></div>";
  }

  /* ---------- view: browse ---------- */
  function viewBrowse() {
    var list = filtered();
    var c = catOf(state.category);

    var title, sub;
    if (state.tag) {
      title = "标签 · " + state.tag;
      sub = "筛选出同时带有该标签的条目";
    } else if (state.category === "all") {
      title = "全部典藏";
      sub = DATA.meta.tagline;
    } else {
      title = c.name;
      sub = c.desc;
    }

    var html = "";
    html += '<div class="section-head">' +
      "<div><h2>" + esc(title) + "</h2>" +
      '<div class="sub">' + esc(sub) + "</div></div></div>";

    html += '<div class="toolbar">' +
      '<select class="select" id="sortSelect">' +
        opt("default", "排序:默认", state.sort) +
        opt("name", "排序:名称", state.sort) +
        opt("rarity", "排序:稀有度", state.sort) +
        opt("category", "排序:分类", state.sort) +
      "</select>" +
      (state.tag || state.category !== "all" || state.query
        ? '<button class="clear-btn" id="clearFilters">清除筛选 ✕</button>'
        : "") +
      '<span class="result-count">共 <b>' + list.length + "</b> 条" +
        (state.query ? " · 关键词「" + esc(state.query) + "」" : "") +
        (state.tag ? " · 标签「" + esc(state.tag) + "」" : "") +
      "</span>" +
    "</div>";

    if (list.length) {
      html += '<div class="grid">' + list.map(cardHTML).join("") + "</div>";
    } else {
      html += '<div class="empty">' +
        '<div class="glyph">🕯</div>' +
        "<h3>此处无有所载</h3>" +
        "<p>没有条目符合当前的检索。或许是它从未被记录,</p>" +
        "<p>或许是被大焚纪烧掉了。</p>" +
      "</div>";
    }

    el.main.innerHTML = html;
  }

  function opt(v, label, cur) {
    return '<option value="' + v + '"' + (cur === v ? " selected" : "") + ">" + esc(label) + "</option>";
  }

  /* ---------- view: detail ---------- */
  function viewDetail(id) {
    var e = entryById(id);
    if (!e) { el.main.innerHTML = notFound(); return; }

    var c = catOf(e.category);

    var html = '<article class="detail">';

    html += '<nav class="breadcrumb">' +
      '<a href="#/">遗产库</a><span class="sep">/</span>' +
      '<a href="#/cat/' + esc(c.id) + '">' + c.glyph + " " + esc(c.name) + "</a>" +
      '<span class="sep">/</span><span>' + esc(e.name) + "</span>" +
    "</nav>";

    html += '<div class="detail-head">' +
      '<div class="detail-art"><span class="glyph">' + esc(e.glyph) + "</span></div>" +
      '<div class="detail-info">' +
        '<div class="eyebrow">' + esc(c.en) + "</div>" +
        "<h1>" + esc(e.name) + "</h1>" +
        '<div class="detail-en">' + esc(e.en) + "</div>" +
        '<div class="detail-meta">' +
          '<span class="rarity ' + esc(e.rarity) + '">' + (RARITY_LABEL[e.rarity] || e.rarity) + "</span>" +
          '<span class="rarity common">' + c.glyph + " " + esc(c.name) + "</span>" +
          (e.tags || []).map(function (t) {
            return '<span class="tag-chip" data-tag="' + esc(t) + '">' + esc(t) + "</span>";
          }).join("") +
        "</div>" +
        '<p class="detail-desc">' + esc(e.desc) + "</p>" +
        (e.habitat ? metaLine("出没 / 现存", e.habitat) : "") +
        (e.weakness ? metaLine("弱点 / 破解", e.weakness) : "") +
        (e.drops && e.drops.length ? metaLine("掉落 / 遗存", e.drops.join(" · ")) : "") +
      "</div>" +
    "</div>";

    if (e.lore && e.lore.length) {
      html += '<div class="lore">' +
        '<div class="lore-title">❖ 纪年残卷</div>' +
        e.lore.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") +
      "</div>";
    }

    if (e.stats && e.stats.length) {
      html += '<h3 class="stats-title">属性评定</h3>';
      html += '<div class="stat-list">' + e.stats.map(function (s) {
        var v = Math.max(0, Math.min(100, Number(s.value) || 0));
        return '<div class="stat-row">' +
          '<span class="k">' + esc(s.label) + "</span>" +
          '<span class="bar"><span style="--w:' + v + '%"></span></span>' +
          '<span class="v">' + v + "</span>" +
        "</div>";
      }).join("") + "</div>";
    }

    /* related */
    var rel = (e.related || [])
      .map(entryById)
      .filter(Boolean)
      .slice(0, 4);

    if (!rel.length) {
      /* fallback: same category, excluding self */
      rel = DATA.entries
        .filter(function (x) { return x.category === e.category && x.id !== e.id; })
        .slice(0, 4);
    }

    if (rel.length) {
      html += '<div class="divider"><i>❖</i></div>';
      html += '<div class="section-head"><div><h2>相关条目</h2>' +
        '<div class="sub">编纂者认为你还会翻阅这些</div></div></div>';
      html += '<div class="grid related-grid">' + rel.map(cardHTML).join("") + "</div>";
    }

    html += "</article>";
    el.main.innerHTML = html;
  }

  function metaLine(k, v) {
    return '<div style="margin-bottom:9px"><span style="font-family:var(--font-ui);font-size:12px;' +
           'letter-spacing:.18em;text-transform:uppercase;color:var(--parchment-mute)">' +
           esc(k) + "</span><br>" +
           '<span style="color:var(--parchment)">' + esc(v) + "</span></div>";
  }

  function notFound() {
    return '<div class="empty"><div class="glyph">📭</div>' +
      "<h3>此页已遗失</h3><p>你要找的条目不在库中,或许它从未存在过。</p>" +
      '<p style="margin-top:20px"><a class="clear-btn" href="#/">← 返回遗产库</a></p></div>';
  }

  /* ---------- routing ---------- */
  function parseHash() {
    var h = (location.hash || "#/").replace(/^#\/?/, "");
    var parts = h.split("/").filter(Boolean);

    if (parts[0] === "entry" && parts[1]) {
      return { view: "detail", id: decodeURIComponent(parts[1]) };
    }
    if (parts[0] === "cat" && parts[1]) {
      return { view: "browse", category: decodeURIComponent(parts[1]), tag: null };
    }
    if (parts[0] === "tag" && parts[1]) {
      return { view: "browse", category: "all", tag: decodeURIComponent(parts[1]) };
    }
    if (parts[0] === "browse") return { view: "browse", category: "all", tag: null };
    return { view: "home" };
  }

  function render() {
    var r = parseHash();
    state.view = r.view;
    if (r.view === "detail") {
      viewDetail(r.id);
    } else if (r.view === "browse") {
      if (r.category !== undefined) state.category = r.category;
      if (r.tag !== undefined) state.tag = r.tag;
      viewBrowse();
    } else {
      state.category = "all";
      state.tag = null;
      viewHome();
    }
    renderSidebar();
    bindDynamic();
    window.scrollTo({ top: 0, behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
  }

  /* ---------- dynamic bindings after innerHTML ---------- */
  function bindDynamic() {
    /* cards */
    el.main.querySelectorAll(".card").forEach(function (node) {
      node.addEventListener("click", function () {
        location.hash = "#/entry/" + encodeURIComponent(node.dataset.id);
      });
    });

    /* tag chips inside main (detail meta) */
    el.main.querySelectorAll(".tag-chip[data-tag]").forEach(function (node) {
      node.addEventListener("click", function () {
        location.hash = "#/tag/" + encodeURIComponent(node.dataset.tag);
      });
    });

    /* sort */
    var sortSel = document.getElementById("sortSelect");
    if (sortSel) {
      sortSel.addEventListener("change", function () {
        state.sort = sortSel.value;
        viewBrowse();
        bindDynamic();
      });
    }

    /* clear filters */
    var clear = document.getElementById("clearFilters");
    if (clear) {
      clear.addEventListener("click", function () {
        state.tag = null;
        state.query = "";
        el.search.value = "";
        location.hash = "#/browse";
      });
    }

    /* goto browse from home */
    el.main.querySelectorAll("[data-goto]").forEach(function (node) {
      node.addEventListener("click", function () {
        location.hash = "#/" + node.dataset.goto;
      });
    });
  }

  /* ---------- sidebar events (bound once) ---------- */
  function bindSidebar() {
    el.catNav.addEventListener("click", function (ev) {
      var row = ev.target.closest(".nav-item");
      if (!row) return;
      state.tag = null;
      var id = row.dataset.cat;
      location.hash = id === "all" ? "#/browse" : "#/cat/" + encodeURIComponent(id);
      closeSidebar();
    });

    el.tagCloud.addEventListener("click", function (ev) {
      var chip = ev.target.closest(".tag-chip");
      if (!chip) return;
      location.hash = "#/tag/" + encodeURIComponent(chip.dataset.tag);
      closeSidebar();
    });
  }

  /* ---------- search ---------- */
  function bindSearch() {
    var t = null;
    el.search.addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        state.query = el.search.value;
        state.tag = null;
        if (state.view !== "browse") {
          state.category = "all";
          location.hash = "#/browse";
        } else {
          viewBrowse();
          bindDynamic();
        }
      }, 180);
    });

    el.search.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        el.search.value = "";
        state.query = "";
        el.search.blur();
        render();
      }
    });
  }

  /* ---------- global keyboard ---------- */
  function bindKeys() {
    document.addEventListener("keydown", function (ev) {
      var tag = (ev.target.tagName || "").toLowerCase();
      var typing = tag === "input" || tag === "textarea" || tag === "select";

      if (ev.key === "/" && !typing) {
        ev.preventDefault();
        el.search.focus();
      }
      if (ev.key === "Escape") closeSidebar();
    });
  }

  /* ---------- mobile sidebar ---------- */
  function openSidebar() {
    el.sidebar.classList.add("open");
    el.backdrop.classList.add("show");
  }
  function closeSidebar() {
    el.sidebar.classList.remove("open");
    el.backdrop.classList.remove("show");
  }
  function bindMobile() {
    el.menuToggle.addEventListener("click", function () {
      el.sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
    });
    el.backdrop.addEventListener("click", closeSidebar);
  }

  /* ---------- random entry ---------- */
  function bindRandom() {
    el.randomBtn.addEventListener("click", function () {
      var pool = DATA.entries;
      var pick = pool[Math.floor(Math.random() * pool.length)];
      location.hash = "#/entry/" + encodeURIComponent(pick.id);
    });
  }

  /* ---------- about ---------- */
  function bindAbout() {
    document.getElementById("themaBtn").addEventListener("click", function () {
      alert(
        "野人遗产库 · The Savage Legacy Archive\n\n" +
        "一个纯静态游戏图鉴库,收录荒原纪元以来的怪物、遗物、秘术、地域与纪年。\n\n" +
        "使用方式:\n" +
        "· 顶部搜索框支持条目名 / 标签 / 地名 / 描述全文检索\n" +
        "· 左侧按分类浏览,或点击常见标签交叉筛选\n" +
        "· 按 / 快速聚焦搜索,按 Esc 清除\n" +
        "· 点右上角骰子随机翻一页\n\n" +
        "内容存于 data/entries.json,可直接编辑扩充。"
      );
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    fetch("data/entries.json", { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (json) {
        DATA = json;
        bindSidebar();
        bindSearch();
        bindKeys();
        bindMobile();
        bindRandom();
        bindAbout();
        window.addEventListener("hashchange", render);
        render();
      })
      .catch(function (err) {
        el.main.innerHTML =
          '<div class="empty"><div class="glyph">🔒</div>' +
          "<h3>典藏无法开启</h3>" +
          "<p>条目数据加载失败:" + esc(err.message) + "</p>" +
          "<p style='margin-top:14px;font-size:13px'>若以 file:// 直接打开,请改用本地服务器" +
          "(如 <code>python -m http.server</code>),或部署到 GitHub Pages。</p></div>";
      });
  }

  boot();
})();
