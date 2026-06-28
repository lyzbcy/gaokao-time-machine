/* ===========================================================
 * home.js — 首页
 *
 * 包含：英雄区、输入表单（省份/年份/分数）、开盒按钮、
 *       今日标签排行榜、最新开盒动态流。
 * =========================================================== */

const HomePage = (function () {

  // 作者联系方式（学校数据缺失时引导用户）
  const AUTHOR_CONTACT = 'https://lyzbcy.github.io/gaokao-time-machine/#/about';

  // 选中的学校所属省份（跨省搜索时记录，开盒时用该校所在省的分数线）
  let selectedSchoolProv = null;

  function render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <section class="hero">
        <h1 class="hero-title">你的高考分数<br>放2026年能上啥？</h1>
        <p class="hero-sub">输入你当年的分数，时光机给你算算现在能上什么学校 🔮</p>
      </section>

      <section class="card input-card">
        <div class="input-row">
          <label>📍 高考省份 <span class="req">*</span></label>
          <select class="select" id="f-province">
            <option value="">选一个省</option>
          </select>
        </div>

        <div class="input-row">
          <label>📅 高考年份 <span class="req">*</span></label>
          <input class="input" id="f-year" list="yearList" autocomplete="off"
                 type="number" min="1977" max="2026" placeholder="比如 2015（可直接输入任意年份）">
          <datalist id="yearList">
            <option value="2026"><option value="2025"><option value="2024"><option value="2023"><option value="2022">
            <option value="2021"><option value="2020"><option value="2019"><option value="2018">
            <option value="2017"><option value="2016"><option value="2015"><option value="2010">
            <option value="2005"><option value="2000"><option value="1995"><option value="1990">
          </datalist>
        </div>

        <div class="input-row">
          <label>📚 科类 <span class="req">*</span></label>
          <select class="select" id="f-track">
            <option value="">先选省份和年份</option>
          </select>
          <span class="muted" style="font-size:11px">科类随省份和年份变化（文理 / 物理历史 / 总分）</span>
        </div>

        <div class="input-row">
          <label>💯 当年总分 <span class="req">*</span></label>
          <input class="input" id="f-score" type="number" min="0" max="750"
                 placeholder="比如 580">
        </div>

        <div class="input-row">
          <label>🏅 当年全省排名 <span class="muted" style="font-size:11px">（选填，建议填写更准）</span></label>
          <input class="input" id="f-rank" type="number" min="1" placeholder="忘了就空着，比如 12000">
          <span class="muted" style="font-size:11px">位次比分数更准；不填会按分数自动估算位次（可能略有偏差）</span>
        </div>

        <div class="input-row">
          <label>🎓 当年录取的学校（选填，输入搜索）</label>
          <div class="school-search">
            <input class="input" id="f-school" autocomplete="off"
                   placeholder="输入校名搜索，如「江南大学」">
            <div class="school-dropdown hidden" id="schoolDropdown"></div>
          </div>
          <span class="muted" style="font-size:11px">从列表选会自动带出该校历年数据；搜不到可自定义录入（需补2026预计分）</span>
        </div>

        <div class="input-row" id="customSchoolRow" style="display:none">
          <label>🔢 自定义学校的 2026 预计录取分 <span style="color:var(--pink)">*</span></label>
          <input class="input" id="f-custom2026" type="number" min="0" max="750"
                 placeholder="比如 590（用于判定今年还能不能上）">
          <span class="muted" style="font-size:11px">列表外学校没有历年数据，需手动录入今年预测分</span>
        </div>

        <div class="input-row">
          <label>📖 专业名（选填，参与判定）</label>
          <input class="input" id="f-major" type="text" placeholder="比如 计算机科学与技术">
        </div>
        <div class="input-row" id="majorScoreRow" style="display:none">
          <label>🎯 该专业当年录取分（选填，用于专业级判定）</label>
          <input class="input" id="f-majorScore" type="number" min="0" max="750"
                 placeholder="比如 595（填了按专业分判，不填按学校分判）">
        </div>

        <button class="open-btn" id="openBtn">
          <img class="btn-emoji" src="img/ui/box.png" alt="" onerror="this.style.display='none'">
          <span>🔮 开 盒</span>
        </button>
        <p class="muted text-center mt-8">已有 <b id="totalCount">0</b> 人开过盒</p>
        <p class="text-center" id="homeCloudBadge"></p>
      </section>

      <!-- 今日标签排行榜 -->
      <h2 class="section-title">📊 今日标签排行榜</h2>
      <section class="card" id="todayRankCard">
        <div class="skeleton" style="height:14px;width:60%;margin-bottom:12px"></div>
        <div class="skeleton" style="height:10px;width:100%;margin-bottom:12px"></div>
        <div class="skeleton" style="height:10px;width:80%"></div>
      </section>

      <!-- 最新动态流 -->
      <h2 class="section-title">🌊 开盒动态</h2>
      <section class="card" id="feedCard">
        <div class="skeleton" style="height:36px;width:100%;margin-bottom:8px"></div>
        <div class="skeleton" style="height:36px;width:100%"></div>
      </section>
    `;

    fillOptions();
    bindEvents();
    loadStats();
  }

  function fillOptions() {
    const provSel = document.getElementById('f-province');
    // 按拼音首字母排序省份
    const codes = Object.keys(SCORE_DATA.provinces).sort((a, b) => {
      return (SCORE_DATA.provinces[a].name).localeCompare(SCORE_DATA.provinces[b].name, 'zh-Hans-CN');
    });
    for (const code of codes) {
      const p = SCORE_DATA.provinces[code];
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = p.name;
      provSel.appendChild(opt);
    }
    // 年份已改为可输入框 + datalist（HTML 内置常用项），这里不再填充
  }

  function bindEvents() {
    document.getElementById('openBtn').addEventListener('click', onOpen);
    ['f-score', 'f-rank'].forEach(id => {
      document.getElementById(id).addEventListener('keydown', e => {
        if (e.key === 'Enter') onOpen();
      });
    });
    // 省份/年份变化 → 联动刷新科类 + 学校列表
    document.getElementById('f-province').addEventListener('change', updateTrackAndSchools);
    document.getElementById('f-year').addEventListener('change', updateTrackAndSchools);
    // 学校搜索联想（输入触发、聚焦显示、失焦延迟隐藏）
    const schoolInput = document.getElementById('f-school');
    schoolInput.addEventListener('input', e => {
      onSchoolInput();
      renderSchoolDropdown(e.target.value);
    });
    schoolInput.addEventListener('focus', e => {
      if (e.target.value.trim()) renderSchoolDropdown(e.target.value);
    });
    schoolInput.addEventListener('blur', () => {
      // 延迟隐藏，让下拉项的 mousedown 先触发
      setTimeout(() => document.getElementById('schoolDropdown')?.classList.add('hidden'), 200);
    });
    // 专业名输入 → 显示专业分输入框
    document.getElementById('f-major').addEventListener('input', e => {
      const row = document.getElementById('majorScoreRow');
      if (row) row.style.display = e.target.value.trim() ? '' : 'none';
    });

    // V4：吉祥物互动——表单聚焦时探头看
    ['f-province','f-year','f-track','f-score','f-rank','f-school','f-major'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('focus', () => window.Mascot && Mascot.setState('peek', {silent:true}));
    });
  }

  // 判断输入的学校是否在列表内（自定义校）
  function isCustomSchool(provData, name) {
    if (!name || !provData) return false;
    return !provData.schools.some(s => s.name === name);
  }

  // 学校搜索：输入时渲染联想下拉
  function renderSchoolDropdown(query) {
    const prov = document.getElementById('f-province').value;
    const dd = document.getElementById('schoolDropdown');
    const provData = SCORE_DATA.provinces[prov];
    if (!dd) return;
    dd.innerHTML = '';
    if (!query) { dd.classList.add('hidden'); return; }

    const q = query.trim().toLowerCase();
    if (!provData) {
      dd.classList.add('hidden');
      return;
    }
    // 模糊匹配校名（跨省全局搜索，本省优先，最多 12 条）
    const tierLabel = { '985': '985', '211': '211', '1': '一本', '2': '二本', '3': '专科' };
    // 1. 本省匹配（优先显示）
    const localMatches = provData.schools
      .filter(s => s.name.toLowerCase().includes(q))
      .map(s => ({ ...s, provCode: prov, provName: provData.name, isLocal: true }));
    // 2. 跨省匹配（补足，去重）
    const localNames = new Set(localMatches.map(s => s.name));
    const crossMatches = [];
    for (const code in SCORE_DATA.provinces) {
      if (code === prov) continue;
      for (const s of SCORE_DATA.provinces[code].schools) {
        if (!localNames.has(s.name) && s.name.toLowerCase().includes(q)) {
          crossMatches.push({ ...s, provCode: code, provName: SCORE_DATA.provinces[code].name, isLocal: false });
          localNames.add(s.name);
        }
      }
    }
    const matches = [...localMatches, ...crossMatches].slice(0, 12);

    if (matches.length === 0) {
      // 未匹配：友好提示
      dd.classList.remove('hidden');
      dd.innerHTML = `
        <div class="school-empty">
          <div>😕 没有找到「${escapeHtml(query)}」相关学校诶</div>
          <div class="school-empty-sub">作者数据不够全，抱歉～你可以：</div>
          <div class="school-empty-actions">
            <a href="${AUTHOR_CONTACT}" target="_blank" rel="noopener" class="school-empty-btn">📮 联系作者补数据</a>
            <span class="school-empty-btn primary" onclick="HomePage.useCustomSchool()">✍️ 直接录入该学校</span>
          </div>
        </div>`;
      return;
    }

    dd.classList.remove('hidden');
    matches.forEach(s => {
      const item = document.createElement('div');
      item.className = 'school-item';
      const provTag = s.isLocal ? '' : `<span class="school-prov">${s.provName}</span>`;
      item.innerHTML = `<span class="school-name">${highlight(s.name, q)}${provTag}</span><span class="school-tier tag-${s.tier}">${tierLabel[s.tier] || s.tier}</span>`;
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        document.getElementById('f-school').value = s.name;
        // 记录该校所属省份（跨省校开盒时用这个省的分数线）
        selectedSchoolProv = s.provCode;
        dd.classList.add('hidden');
        onSchoolInput();
      });
      dd.appendChild(item);
    });
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function highlight(name, q) {
    const idx = name.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return escapeHtml(name);
    return escapeHtml(name.slice(0, idx)) + '<b>' + escapeHtml(name.slice(idx, idx + q.length)) + '</b>' + escapeHtml(name.slice(idx + q.length));
  }

  // 用户点"直接录入该学校"：保留下拉文本，显示自定义分数框
  function useCustomSchool() {
    document.getElementById('schoolDropdown').classList.add('hidden');
    onSchoolInput();
    document.getElementById('f-custom2026')?.focus();
  }

  function onSchoolInput() {
    const prov = document.getElementById('f-province').value;
    const provData = SCORE_DATA.provinces[prov];
    const name = document.getElementById('f-school').value.trim();
    const customRow = document.getElementById('customSchoolRow');
    const isCustom = name && isCustomSchool(provData, name);
    if (customRow) customRow.style.display = isCustom ? '' : 'none';
  }

  // 根据所选省份+年份，刷新科类下拉 + 清空学校搜索
  function updateTrackAndSchools() {
    const prov = document.getElementById('f-province').value;
    const year = parseInt(document.getElementById('f-year').value, 10);
    const trackSel = document.getElementById('f-track');
    trackSel.innerHTML = '';

    if (!prov || !year) {
      trackSel.innerHTML = '<option value="">先选省份和年份</option>';
      return;
    }

    // 从 rank-tables 取该省该年的科类
    const tracks = (window.RANK_DATA && RANK_DATA.provinces[prov] && RANK_DATA.provinces[prov].years[year])
      ? Object.keys(RANK_DATA.provinces[prov].years[year])
      : ['science', 'arts'];
    trackSel.innerHTML = '<option value="">选科类</option>';
    tracks.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = RankConverter.trackLabel(t);
      trackSel.appendChild(opt);
    });

    // 选省份变化时重置学校输入、隐藏下拉、隐藏自定义框
    const schoolInput = document.getElementById('f-school');
    schoolInput.value = '';
    selectedSchoolProv = null;
    document.getElementById('schoolDropdown')?.classList.add('hidden');
    onSchoolInput();
  }

  function validate() {
    const prov = document.getElementById('f-province').value;
    const year = parseInt(document.getElementById('f-year').value, 10);
    const track = document.getElementById('f-track').value;
    const score = parseInt(document.getElementById('f-score').value, 10);
    // 全省排名非必填：空则用分数反查当年位次（box-engine 内处理）
    const rankRaw = document.getElementById('f-rank').value.trim();
    const rank = rankRaw ? parseInt(rankRaw, 10) : undefined;
    const school = document.getElementById('f-school').value.trim() || undefined;
    const major = document.getElementById('f-major').value.trim() || undefined;
    const majorScore = parseInt(document.getElementById('f-majorScore').value, 10) || undefined;
    const custom2026 = parseInt(document.getElementById('f-custom2026').value, 10) || undefined;

    if (!prov) { App.toast('请先选省份～'); return null; }
    if (!year || year < 1977 || year > 2026) { App.toast('年份填得不对哦（1977-2026）～'); return null; }
    if (!track) { App.toast('请选科类（文理/物理历史/总分）～'); return null; }
    if (!score || score < 0 || score > 750) { App.toast('分数填得不对哦（0-750）～'); return null; }
    if (rank !== undefined && rank < 1) { App.toast('全省排名得是正数～'); return null; }
    // 自定义学校必须填 2026 预计分
    if (school && isCustomSchool(SCORE_DATA.provinces[prov], school) && (!custom2026 || custom2026 < 0 || custom2026 > 750)) {
      App.toast('你填的学校不在数据库，请补上「2026预计录取分」～');
      return null;
    }
    return {
      province: prov, provinceName: SCORE_DATA.provinces[prov].name,
      year, score, rank, track, chosenSchool: school, major, majorScore, custom2026,
    };
  }

  async function onOpen() {
    const input = validate();
    if (!input) {
      // V4：校验失败，吉祥物生气
      if (window.Mascot) Mascot.flash('angry', 2000);
      return;
    }

    // V5：按需懒加载分数线（每省都有全部学校，直接用用户选的省）
    let provData;
    try {
      if (window.ScoreLoader) {
        provData = await ScoreLoader.loadProvScores(input.province);
      } else {
        provData = SCORE_DATA.provinces[input.province];
      }
    } catch (e) {
      App.toast('该省数据加载失败，请重试～');
      if (window.Mascot) Mascot.flash('angry', 2000);
      return;
    }
    if (!provData) { App.toast('数据加载异常'); return; }

    // V4：吉祥物欢呼开盒
    if (window.Mascot) Mascot.setState('spin');

    // 开盒动效
    await App.playBoxAnimation();

    // 计算
    const result = BoxEngine.open(input, provData);
    result.trashTalk = TrashTalk.generate(result);

    // V4：按结果触发吉祥物庆祝/安慰
    if (window.Mascot) {
      if (result.tierDelta > 0) Mascot.setState('happy');
      else if (result.tierDelta < 0) Mascot.setState('cry');
      else Mascot.setState('idle');
    }

    // 保存
    const record = {
      labelId: result.label.id,
      labelName: result.label.name,
      tier: result.label.tier,
      province: input.province,
      provinceName: input.provinceName,
      year: input.year,
      score: input.score,
      rank: input.rank,
      track: input.track,
      trackLabel: RankConverter.trackLabel(input.track),
      major: input.major || '',
      majorScore: input.majorScore || null,
      chosenSchool: input.chosenSchool || '',
      equivalentScore2026: result.equivalentScore2026,
      timestamp: result.timestamp,
    };
    await Repo.saveRecord(record);

    // 跳转结果页（带数据）
    App.lastResult = result;
    App.lastInput = input;
    location.hash = '#/result';
  }

  async function loadStats() {
    // 总数
    Repo.getTotalCount().then(n => {
      const el = document.getElementById('totalCount');
      if (el) el.textContent = n;
    });

    // 后端连接状态徽章
    const badgeEl = document.getElementById('homeCloudBadge');
    if (badgeEl) {
      const cloudOn = window.SupabaseConfig && SupabaseConfig.isReady && SupabaseConfig.isReady();
      badgeEl.innerHTML = cloudOn
        ? '<span class="cloud-badge on">☁️ 已连接云端 · 全网实时同步</span>'
        : '<span class="cloud-badge off">📱 单机模式 · 仅本地数据</span>';
    }

    // 今日排行榜
    try {
      const stats = await Repo.getTodayLabelStats();
      renderTodayRank(stats);
    } catch (e) {
      document.getElementById('todayRankCard').innerHTML =
        '<p class="muted text-center">数据加载失败，刷新试试</p>';
    }

    // 动态流
    try {
      const provs = await Repo.getProvinceStats();
      renderFeed(provs);
    } catch (e) {
      document.getElementById('feedCard').innerHTML =
        '<p class="muted text-center">动态加载失败</p>';
    }
  }

  function renderTodayRank(stats) {
    const card = document.getElementById('todayRankCard');
    if (!stats || stats.length === 0) {
      card.innerHTML = '<p class="muted text-center">今天还没人开盒，快来当第一个！</p>';
      return;
    }
    const html = stats.slice(0, 8).map(s => {
      const def = Labels.get(s.labelId);
      const tier = Labels.tier(def?.tier || 'n');
      const probPct = (s.prob * 100).toFixed(1);
      const color = tier.color;
      return `
        <div class="prob-bar-item">
          <div class="prob-bar-head">
            <span class="left">
              <span>${def?.emoji || '❓'}</span>
              <span>${s.name}</span>
              <span class="rarity-pill" style="font-size:9px;padding:1px 6px;border-radius:4px;background:${color};color:#fff">${tier.name}</span>
            </span>
            <span class="pct">${probPct}%</span>
          </div>
          <div class="prob-bar-track">
            <div class="prob-bar-fill" style="width:${probPct}%;background:${color}"></div>
          </div>
        </div>
      `;
    }).join('');
    card.innerHTML = html;
  }

  function renderFeed(provs) {
    const card = document.getElementById('feedCard');
    if (!provs || provs.length === 0) {
      card.innerHTML = '<p class="muted text-center">还没有人开过盒，点击上方 🔮 开盒试试～</p>';
      return;
    }
    const html = provs.slice(0, 6).map(p => {
      const def = p.topLabelDef;
      return `
        <div class="feed-item">
          <span>${def?.emoji || '🎁'}</span>
          <span class="who">${p.province}的网友</span>
          <span>抽到了</span>
          <span class="label">${def?.name || '神秘标签'}</span>
          <span class="pct" style="margin-left:auto;color:var(--text-light);font-size:11px">${p.count}次</span>
        </div>
      `;
    }).join('');
    card.innerHTML = html;
  }

  return { render, useCustomSchool };
})();

window.HomePage = HomePage;
