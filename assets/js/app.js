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
    sort: "default",
    month: null,         // "2026-11" — 停服游戏按月细分
    company: null
  };

  var GAME_CAT = "relic";

  /* 大列表渐进渲染:条目数超过 PAGE_SIZE 时先渲染一批,其余点击"加载更多" */
  var PAGE_SIZE = 240;

  /* ------------------------------------------------------------
     封面图来源开关
     -----------------------------------------
     "local"  → 用仓库内的 assets/img/covers/*(离线可用,但新增游戏要补图)
     "remote" → 用 data 里的 remoteImg 直链(零维护,但依赖原站)
     "auto"   → 先试本地,加载失败自动回退到远程(推荐)
     ------------------------------------------------------------ */
  var IMG_MODE = "auto";

  function imgSrc(e) {
    if (!isGame(e)) return e.icon || (e.game && e.game.remoteImg) || "";
    var local = e.game.img || "";
    var remote = e.game.remoteImg || "";
    if (IMG_MODE === "remote") return remote || local;
    if (IMG_MODE === "local") return local || remote;
    return local || remote;                 /* auto: 优先本地 */
  }

  function imgFallback(e) {
    if (!isGame(e)) return "";
    var local = e.game.img || "";
    var remote = e.game.remoteImg || "";
    if (IMG_MODE === "auto") {
      /* 本地挂了 → 回退远程;远程挂了 → 空(显示字形) */
      return local && remote ? remote : "";
    }
    return "";
  }

  /* 判定"真"停服游戏条目:game 对象里至少要有日期或厂商。
     后台编辑器会给任意条目补全空的 game 对象(仅存 remoteImg 用),
     这种"只挂图"的条目按普通条目处理,不进月份/厂商管线。 */
  function isGame(e) {
    var g = e.game;
    return !!g && !!(g.start || g.end || g.company || g.endYear || g.endMonth);
  }

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

  /* ---------- game helpers ---------- */
  function gameEntries() {
    return DATA.entries.filter(isGame);
  }

  function monthKey(e) {
    var m = e.game.endMonth, y = e.game.endYear;
    return y + "-" + (m < 10 ? "0" + m : m);
  }

  function monthLabel(key) {
    var p = key.split("-");
    return p[0] + "年" + parseInt(p[1], 10) + "月";
  }

  /* 停服月份列表,新的在前 */
  function gameMonths() {
    var seen = {}, out = [];
    gameEntries().forEach(function (e) {
      var k = monthKey(e);
      if (!seen[k]) { seen[k] = 0; out.push(k); }
      seen[k]++;
    });
    return out.sort().reverse().map(function (k) {
      return { key: k, label: monthLabel(k), count: seen[k] };
    });
  }

  /* 即将停服(2026-09 及以后) */
  function upcomingGames() {
    return gameEntries()
      .filter(function (e) { return e.game.future; })
      .sort(function (a, b) {
        return a.game.end < b.game.end ? -1 : a.game.end > b.game.end ? 1 : 0;
      });
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
    if (state.month === "__upcoming__") {
      list = list.filter(function (e) { return isGame(e) && e.game.future; });
    } else if (state.month) {
      list = list.filter(function (e) { return isGame(e) && monthKey(e) === state.month; });
    }
    if (state.company) {
      list = list.filter(function (e) { return isGame(e) && e.game.company === state.company; });
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
          (e.drops || []).join(" "),
          e.game ? e.game.company : "",
          e.game ? e.game.start + " " + e.game.end : ""
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
      case "days":
        list.sort(function (a, b) {
          return (b.game ? b.game.days : 0) - (a.game ? a.game.days : 0);
        });
        break;
      case "shutdown":
        list.sort(function (a, b) {
          var x = a.game ? a.game.end : "9999";
          var y = b.game ? b.game.end : "9999";
          return x < y ? -1 : x > y ? 1 : 0;
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

      /* 遗物志展开:停服游戏按月细分 */
      if (c.id === GAME_CAT) {
        var months = gameMonths();
        var upcoming = upcomingGames().length;
        var open = state.category === GAME_CAT;

        html += '<div class="subnav' + (open ? " open" : "") + '">';
        html += '<div class="subnav-item subnav-hot' +
                (state.month === "__upcoming__" ? " active" : "") +
                '" data-month="__upcoming__">' +
                  '<span class="glyph">⚠</span><span>即将停服</span>' +
                  '<span class="count">' + upcoming + "</span></div>";
        html += '<div class="subnav-item' + (!state.month ? " active" : "") +
                '" data-month=""><span class="glyph">◇</span><span>全部月份</span></div>';
        months.forEach(function (m) {
          html += '<div class="subnav-item' + (state.month === m.key ? " active" : "") +
                  '" data-month="' + m.key + '">' +
                    '<span class="glyph">▸</span><span>' + esc(m.label) + "</span>" +
                    '<span class="count">' + m.count + "</span></div>";
        });
        html += "</div>";
      }
    });
    el.catNav.innerHTML = html;

    /* 标签云:游戏库占多数,改为厂商 + 停服年月混合 */
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
    var isG = isGame(e);
    var src = imgSrc(e);
    var fb = imgFallback(e);

    var art;
    if (src) {
      art = '<div class="card-art game-art">' +
              '<img src="' + esc(src) + '" alt="' + esc(e.name) + '" loading="lazy" ' +
                   'data-fb="' + esc(fb) + '" ' +
                   'onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb=0;}else{this.parentNode.classList.add(\'img-fail\');this.remove();}">' +
              '<span class="glyph">' + esc(e.glyph) + "</span>" +
            "</div>";
    } else {
      art = '<div class="card-art"><span class="glyph">' + esc(e.glyph) + "</span></div>";
    }

    var footRight = isG
      ? '<span class="card-cat">📅 ' + esc(e.game.end.replace(/-/g, "/")) + "</span>"
      : '<span class="card-cat">' + c.glyph + " " + esc(c.name) + "</span>";

    var badge = (isG && e.game.future)
      ? '<span class="soon-badge">即将停服</span>' : "";

    return '<article class="card" data-id="' + esc(e.id) + '" data-rarity="' + esc(e.rarity) +
           '" style="animation-delay:' + delay + 'ms">' +
             badge +
             art +
             '<div class="card-body">' +
               '<h3 class="card-title">' + esc(e.name) + "</h3>" +
               '<div class="card-en">' + esc(e.en) + "</div>" +
               '<p class="card-desc">' + esc(e.desc) + "</p>" +
               '<div class="card-foot">' +
                 '<span class="rarity ' + esc(e.rarity) + '">' + (RARITY_LABEL[e.rarity] || e.rarity) + "</span>" +
                 footRight +
               "</div>" +
             "</div>" +
           "</article>";
  }

  /* ---------- view: home ---------- */
  function viewHome() {
    var m = DATA.meta;
    var games = gameEntries();
    var upcoming = upcomingGames();
    var months = gameMonths();

    var html = "";
    html += '<section class="hero">' +
      '<div class="hero-glyph">野</div>' +
      '<div class="eyebrow">The Savage Legacy Archive</div>' +
      "<h1>" + esc(m.title) + "</h1>" +
      "<p>" + esc(m.intro) + "</p>" +
      '<div class="hero-stats">' +
        stat(games.length, "遗物 · 停服游戏") +
        stat(upcoming.length, "即将停服") +
        stat(months.length, "停服月份") +
        stat(DATA.entries.length, "收录条目") +
      "</div>" +
    "</section>";

    /* 即将停服名录 */
    if (upcoming.length) {
      html += '<div class="section-head">' +
        "<div><h2>⚠ 停服通告 · 即将终止</h2>" +
        '<div class="sub">以下作品已公布停服预定,留给你道别的时间不多了</div></div>' +
        '<button class="clear-btn" data-goto="browse">浏览全部 →</button>' +
      "</div>";
      html += '<div class="grid">' + upcoming.slice(0, 8).map(cardHTML).join("") + "</div>";
      if (upcoming.length > 8) {
        html += '<p class="more-hint">还有 ' + (upcoming.length - 8) +
                ' 款即将停服作品 · <a href="#/month/__upcoming__">查看全部 ⚠</a></p>';
      }
      html += '<div class="divider"><i>❖</i></div>';
    }

    /* 运营传奇 —— 最长的几款 */
    var longliving = games.slice().sort(function (a, b) {
      return b.game.days - a.game.days;
    }).slice(0, 4);

    html += '<div class="section-head">' +
      "<div><h2>传奇 · 运营最久的作品</h2>" +
      '<div class="sub">在手机游戏普遍活不过三年的荒原上,它们撑下来了</div></div>' +
    "</div>";
    html += '<div class="grid">' + longliving.map(cardHTML).join("") + "</div>";

    /* 最近停服 */
    var recent = games.slice().sort(function (a, b) {
      return a.game.end < b.game.end ? 1 : a.game.end > b.game.end ? -1 : 0;
    }).slice(0, 8);

    html += '<div class="divider"><i>❖</i></div>';
    html += '<div class="section-head">' +
      "<div><h2>近录 · 最新停服</h2>" +
      '<div class="sub">按终止日期倒序</div></div>' +
    "</div>";
    html += '<div class="grid">' + recent.map(cardHTML).join("") + "</div>";

    /* 按月份浏览 */
    html += '<div class="divider"><i>❖</i></div>';
    html += '<div class="section-head">' +
      "<div><h2>编年 · 按停服月份翻检</h2>" +
      '<div class="sub">共 ' + months.length + ' 个月份的名录</div></div>' +
    "</div>";
    html += '<div class="month-grid">' + months.map(function (mm) {
      return '<a class="month-tile" href="#/month/' + mm.key + '">' +
               '<span class="mt-label">' + esc(mm.label) + "</span>" +
               '<span class="mt-count">' + mm.count + " 款</span>" +
             "</a>";
    }).join("") + "</div>";

    html += '<div class="divider"><i>❖</i></div>';
    html += '<div class="section-head">' +
      "<div><h2>卷首 · 神话与传说</h2>" +
      '<div class="sub">凡被记入此卷者,皆已无可挽回</div></div>' +
    "</div>";
    var feats = DATA.entries.filter(function (e) {
      return !isGame(e) && (e.rarity === "mythic" || e.rarity === "legendary");
    }).slice(0, 4);
    html += '<div class="grid">' + feats.map(cardHTML).join("") + "</div>";

    el.main.innerHTML = html;
  }

  function stat(num, lbl) {
    return '<div class="stat"><div class="num">' + num + '</div><div class="lbl">' + esc(lbl) + "</div></div>";
  }

  /* ---------- view: browse ---------- */
  function viewBrowse() {
    var list = filtered();
    var c = catOf(state.category);
    var isGameBrowse = state.category === GAME_CAT || state.month || state.company;
    var upcoming = state.month === "__upcoming__";

    /* 筛选条件一旦变化,重新从第一批开始渲染 */
    var sig = [state.category, state.tag, state.month, state.company, state.query, state.sort].join("|");
    if (state.sig !== sig) { state.sig = sig; state.shown = PAGE_SIZE; }

    var title, sub;
    if (upcoming) {
      title = "⚠ 即将停服";
      sub = "已公布停服预定、服务尚未终止的作品";
    } else if (state.month) {
      title = "停服名录 · " + monthLabel(state.month);
      sub = "于该月终止服务的手机游戏";
    } else if (state.company) {
      title = "厂商 · " + state.company;
      sub = "由该厂商运营并已终止的作品";
    } else if (state.tag) {
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

    if (isGameBrowse) {
      var months = gameMonths();
      html += '<div class="month-strip">' +
        '<a class="mchip mchip-hot' + (upcoming ? " active" : "") +
          '" href="#/month/__upcoming__">⚠ 即将停服</a>' +
        '<a class="mchip' + (state.category === GAME_CAT && !state.month && !state.company ? " active" : "") +
          '" href="#/cat/' + GAME_CAT + '">全部 ' + gameEntries().length + '</a>' +
        months.map(function (mm) {
          return '<a class="mchip' + (state.month === mm.key ? " active" : "") +
                 '" href="#/month/' + mm.key + '">' + esc(mm.label) + "</a>";
        }).join("") +
      "</div>";
    }

    html += '<div class="toolbar">' +
      '<select class="select" id="sortSelect">' +
        opt("default", "排序:默认", state.sort) +
        (isGameBrowse ? opt("shutdown", "排序:停服日期", state.sort) : "") +
        (isGameBrowse ? opt("days", "排序:运营天数", state.sort) : "") +
        opt("name", "排序:名称", state.sort) +
        opt("rarity", "排序:稀有度", state.sort) +
      "</select>" +
      '<button class="clear-btn" id="clearFilters">清除筛选 ✕</button>' +
      '<span class="result-count">共 <b>' + list.length + "</b> 款" +
        (state.query ? " · 关键词「" + esc(state.query) + "」" : "") +
        (state.tag ? " · 标签「" + esc(state.tag) + "」" : "") +
      "</span>" +
    "</div>";

    if (list.length) {
      var shown = Math.min(state.shown || PAGE_SIZE, list.length);
      html += '<div class="grid" id="browseGrid">' +
              list.slice(0, shown).map(cardHTML).join("") + "</div>";
      if (shown < list.length) {
        html += '<div class="more-wrap">' +
          '<button class="clear-btn" id="loadMoreBtn">加载更多 · 尚余 ' +
          (list.length - shown) + " 款</button></div>";
      }
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
    var isG = isGame(e);

    var html = '<article class="detail">';

    html += '<nav class="breadcrumb">' +
      '<a href="#/">遗产库</a><span class="sep">/</span>' +
      '<a href="#/cat/' + esc(c.id) + '">' + c.glyph + " " + esc(c.name) + "</a>" +
      (isG ? '<span class="sep">/</span><a href="#/month/' + monthKey(e) + '">' +
              esc(monthLabel(monthKey(e))) + "</a>" : "") +
      '<span class="sep">/</span><span>' + esc(e.name) + "</span>" +
    "</nav>";

    var detailSrc = imgSrc(e);
    var detailFb  = imgFallback(e);
    var detailArt = detailSrc
      ? '<div class="detail-art game-art">' +
          '<img src="' + esc(detailSrc) + '" alt="' + esc(e.name) + '" ' +
               'data-fb="' + esc(detailFb) + '" ' +
               'onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb=0;}else{this.parentNode.classList.add(\'img-fail\');this.remove();}">' +
          '<span class="glyph">' + esc(e.glyph) + "</span></div>"
      : '<div class="detail-art"><span class="glyph">' + esc(e.glyph) + "</span></div>";

    html += '<div class="detail-head">' +
      detailArt +
      '<div class="detail-info">' +
        '<div class="eyebrow">' + esc(c.en) + "</div>" +
        "<h1>" + esc(e.name) + "</h1>" +
        '<div class="detail-en">' + esc(isG ? (e.game.company || e.en) : e.en) + "</div>" +
        '<div class="detail-meta">' +
          '<span class="rarity ' + esc(e.rarity) + '">' + (RARITY_LABEL[e.rarity] || e.rarity) + "</span>" +
          (isG && e.game.future ? '<span class="soon-badge inline">即将停服</span>' : "") +
          (isG
            ? '<span class="tag-chip" data-month="' + monthKey(e) + '">📅 ' + esc(monthLabel(monthKey(e))) + "</span>"
            : '<span class="rarity common">' + c.glyph + " " + esc(c.name) + "</span>") +
          (isG && e.game.company
            ? '<span class="tag-chip" data-company="' + esc(e.game.company) + '">🏢 ' + esc(e.game.company) + "</span>"
            : "") +
          (isG
            ? ""
            : (e.tags || []).map(function (t) {
                return '<span class="tag-chip" data-tag="' + esc(t) + '">' + esc(t) + "</span>";
              }).join("")) +
        "</div>" +
        '<p class="detail-desc">' + esc(e.desc) + "</p>" +
        (isG ? gameFacts(e) : "") +
        (!isG && e.byline ? metaLine("出处 / 制作者", e.byline) : "") +
        (!isG && e.habitat ? metaLine("出没 / 现存", e.habitat) : "") +
        (!isG && e.weakness ? metaLine("弱点 / 破解", e.weakness) : "") +
        (!isG && e.drops && e.drops.length ? metaLine("掉落 / 遗存", e.drops.join(" · ")) : "") +
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
      if (isG) {
        /* 同厂商优先,其次同月停服 */
        var sameCo = gameEntries().filter(function (x) {
          return x.id !== e.id && x.game.company === e.game.company;
        });
        var sameMonth = gameEntries().filter(function (x) {
          return x.id !== e.id && monthKey(x) === monthKey(e);
        });
        var seenR = {};
        rel = sameCo.concat(sameMonth).filter(function (x) {
          if (seenR[x.id]) return false;
          seenR[x.id] = 1; return true;
        }).slice(0, 4);
      } else {
        rel = DATA.entries.filter(function (x) {
          return x.category === e.category && x.id !== e.id;
        }).slice(0, 4);
      }
    }

    if (rel.length) {
      html += '<div class="divider"><i>❖</i></div>';
      html += '<div class="section-head"><div><h2>相关条目</h2>' +
        '<div class="sub">' + (isG ? "同一厂商,或同月停服的作品" : "编纂者认为你还会翻阅这些") +
        "</div></div></div>";
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

  /* 原站/商店外链已移除(2026-10-07 用户要求"禁止显示数据来源")。
     条目里的 link 字段不再渲染,详见 data/entries.json。 */

  function isoLabel(d) {
    var p = d.split("-");
    return p[0] + "年" + parseInt(p[1], 10) + "月" + parseInt(p[2], 10) + "日";
  }

  function gameFacts(e) {
    var g = e.game;
    var status = g.future
      ? '<span style="color:var(--blood-bright);font-weight:700">即将终止</span>'
      : '<span style="color:var(--parchment-mute)">已终止</span>';

    var h = '<div class="facts">' +
      fact("运营期间", isoLabel(g.start) + " ～ " + isoLabel(g.end)) +
      fact("运营天数", g.days.toLocaleString() + " 日（约 " + (g.days / 365.25).toFixed(1) + " 年）") +
      fact("开发 / 运营", g.company) +
      fact("当前状态", status, true) +
      fact("停服月份", monthLabel(monthKey(e))) +
    "</div>";

    return h;
  }

  function fact(k, v, raw) {
    return '<div class="fact"><span class="fk">' + esc(k) + "</span>" +
           '<span class="fv">' + (raw ? v : esc(v)) + "</span></div>";
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
      return { view: "browse", category: decodeURIComponent(parts[1]), tag: null, month: null, company: null };
    }
    if (parts[0] === "month" && parts[1]) {
      var mo = decodeURIComponent(parts[1]);
      return {
        view: "browse",
        category: mo === "__upcoming__" ? GAME_CAT : "all",
        month: mo, tag: null, company: null
      };
    }
    if (parts[0] === "company" && parts[1]) {
      return {
        view: "browse", category: GAME_CAT,
        company: decodeURIComponent(parts[1]), month: null, tag: null
      };
    }
    if (parts[0] === "tag" && parts[1]) {
      return { view: "browse", category: "all", tag: decodeURIComponent(parts[1]), month: null, company: null };
    }
    if (parts[0] === "browse") {
      return { view: "browse", category: "all", tag: null, month: null, company: null };
    }
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
      if (r.month !== undefined) state.month = r.month;
      if (r.company !== undefined) state.company = r.company;
      viewBrowse();
    } else {
      state.category = "all";
      state.tag = null;
      state.month = null;
      state.company = null;
      viewHome();
    }
    renderSidebar();
    bindDynamic();
    window.scrollTo({ top: 0, behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
  }

  /* ---------- dynamic bindings after innerHTML ---------- */
  function bindCards() {
    el.main.querySelectorAll(".card").forEach(function (node) {
      if (node.dataset.bound) return;
      node.dataset.bound = "1";
      node.addEventListener("click", function () {
        location.hash = "#/entry/" + encodeURIComponent(node.dataset.id);
      });
    });
  }

  function bindDynamic() {
    /* cards */
    bindCards();

    /* load more · 大列表渐进渲染 */
    var more = document.getElementById("loadMoreBtn");
    if (more) {
      more.addEventListener("click", function () {
        var all = filtered();
        var grid = document.getElementById("browseGrid");
        var start = state.shown || PAGE_SIZE;
        var end = Math.min(start + PAGE_SIZE, all.length);
        if (!grid) return;
        grid.insertAdjacentHTML("beforeend", all.slice(start, end).map(cardHTML).join(""));
        state.shown = end;
        if (end >= all.length) {
          more.parentNode.removeChild(more);
        } else {
          more.textContent = "加载更多 · 尚余 " + (all.length - end) + " 款";
        }
        bindCards();
      });
    }

    /* tag chips inside main (detail meta) */
    el.main.querySelectorAll(".tag-chip[data-tag]").forEach(function (node) {
      node.addEventListener("click", function () {
        location.hash = "#/tag/" + encodeURIComponent(node.dataset.tag);
      });
    });

    /* month chips inside main (detail meta + month strip) */
    el.main.querySelectorAll("[data-month]").forEach(function (node) {
      node.addEventListener("click", function () {
        location.hash = "#/month/" + encodeURIComponent(node.dataset.month);
      });
    });

    /* company chips */
    el.main.querySelectorAll("[data-company]").forEach(function (node) {
      node.addEventListener("click", function () {
        location.hash = "#/company/" + encodeURIComponent(node.dataset.company);
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
        state.month = null;
        state.company = null;
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
      var sub = ev.target.closest(".subnav-item");
      if (sub) {
        var mo = sub.dataset.month;
        location.hash = mo === "" ? "#/cat/" + GAME_CAT
                                 : "#/month/" + encodeURIComponent(mo);
        closeSidebar();
        return;
      }
      var row = ev.target.closest(".nav-item");
      if (!row) return;
      state.tag = null;
      state.month = null;
      state.company = null;
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
        state.month = null;
        state.company = null;
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

  /* ---------- 封面图来源切换 ---------- */
  var IMG_MODE_LABEL = { auto: "自动(本地→远程)", local: "仅本地", remote: "仅远程直链" };

  function loadImgMode() {
    try {
      var v = localStorage.getItem("wl_imgmode");
      if (v === "local" || v === "remote" || v === "auto") IMG_MODE = v;
    } catch (e) { /* ignore */ }
  }

  function bindImgMode() {
    var btn = document.getElementById("imgModeBtn");
    if (!btn) return;
    btn.title = "封面图来源:" + IMG_MODE_LABEL[IMG_MODE] + "(点击切换)";
    btn.style.color = IMG_MODE === "remote" ? "var(--arcane)" : "";

    btn.addEventListener("click", function () {
      var order = ["auto", "remote", "local"];
      IMG_MODE = order[(order.indexOf(IMG_MODE) + 1) % order.length];
      try { localStorage.setItem("wl_imgmode", IMG_MODE); } catch (e) {}
      btn.title = "封面图来源:" + IMG_MODE_LABEL[IMG_MODE] + "(点击切换)";
      btn.style.color = IMG_MODE === "remote" ? "var(--arcane)" : "";
      render();     /* 立即重绘,切换效果可见 */
    });
  }

  /* ---------- random entry ---------- */
  function bindRandom() {
    el.randomBtn.addEventListener("click", function () {
      var pool = gameEntries();
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
        loadImgMode();
        bindSidebar();
        bindSearch();
        bindKeys();
        bindMobile();
        bindImgMode();
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
