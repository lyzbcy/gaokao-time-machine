/* ===========================================================
 * repository.js — 数据层统一接口
 *
 * 提供：saveRecord / getTodayLabelStats / getRarityRanking /
 *       getProvinceStats / getUserCollection / getUserHistory
 *
 * 后端实现可切换：
 *   - Supabase 已配置 → 真实多用户数据（见 config/supabase.js）
 *   - 未配置         → localStorage 单机版（自动回退）
 *
 * 调用方只管调 Repo.xxx()，不关心数据来自哪里。
 * =========================================================== */

const Repo = (function () {

  const LS_HISTORY = 'gk_box_history';     // 当前用户历史
  const LS_GLOBAL  = 'gk_box_global';      // 模拟全局统计（localStorage 版用）

  // ---------- 内部：读取/写入 ----------
  function readHistory() {
    try { return JSON.parse(localStorage.getItem(LS_HISTORY) || '[]'); }
    catch { return []; }
  }
  function writeHistory(arr) {
    localStorage.setItem(LS_HISTORY, JSON.stringify(arr));
  }
  function readGlobal() {
    try { return JSON.parse(localStorage.getItem(LS_GLOBAL) || '[]'); }
    catch { return []; }
  }
  function writeGlobal(arr) {
    localStorage.setItem(LS_GLOBAL, JSON.stringify(arr));
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  }

  function isSupabaseReady() {
    return !!(window.SupabaseConfig && window.SupabaseConfig.isReady && window.SupabaseConfig.isReady());
  }

  // ---------- 公开接口 ----------

  /**
   * 保存一条开盒记录
   * @param {Object} record { labelId, tier, province, provinceName, year, score, timestamp }
   */
  async function saveRecord(record) {
    // 1. 本地历史（始终记录，保证"我的记录"可用）
    const hist = readHistory();
    hist.unshift(record);
    // 最多保留 100 条
    if (hist.length > 100) hist.length = 100;
    writeHistory(hist);

    // 2. 全局统计
    if (isSupabaseReady()) {
      try {
        await window.SupabaseConfig.insertRecord(record);
        return;
      } catch (e) {
        console.warn('[Repo] Supabase 写入失败，回退本地：', e);
      }
    }
    // localStorage 版：写入本地"全局"（仅供演示，单机）
    const g = readGlobal();
    g.unshift(record);
    if (g.length > 2000) g.length = 2000;
    writeGlobal(g);
  }

  /**
   * 今日标签分布（用于首页概率柱状图）
   * @returns {Array<{labelId, name, emoji, count, prob}>}
   */
  async function getTodayLabelStats() {
    let records;
    if (isSupabaseReady()) {
      try { records = await window.SupabaseConfig.fetchTodayRecords(); }
      catch (e) { console.warn('[Repo] Supabase 读取失败，回退本地', e); }
    }
    if (!records) records = readGlobal();

    const today = todayKey();
    const todays = records.filter(r => {
      const d = new Date(r.timestamp);
      const k = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
      return k === today;
    });

    return aggregateByLabel(todays.length ? todays : records); // 今日为空则展示全部
  }

  function aggregateByLabel(records) {
    const map = {};
    let total = 0;
    for (const r of records) {
      const id = r.labelId;
      if (!map[id]) {
        const def = Labels.get(id);
        map[id] = { labelId: id, name: def?.name || id, emoji: def?.emoji || '❓', tier: def?.tier || 'n', count: 0 };
      }
      map[id].count++;
      total++;
    }
    const arr = Object.values(map);
    arr.forEach(a => a.prob = total > 0 ? a.count / total : 0);
    arr.sort((a, b) => b.count - a.count);
    return arr;
  }

  /**
   * 稀有度排行榜（SSR/SR/隐藏 哪个最少见）
   */
  async function getRarityRanking() {
    let records;
    if (isSupabaseReady()) {
      try { records = await window.SupabaseConfig.fetchAllRecords(); }
      catch (e) { console.warn('[Repo] Supabase 读取失败，回退本地', e); }
    }
    if (!records) records = readGlobal();

    const tiers = {};
    for (const r of records) {
      tiers[r.tier] = (tiers[r.tier] || 0) + 1;
    }
    const total = records.length || 1;
    const order = ['hidden', 'ssr', 'sr', 'r', 'n'];
    return order
      .filter(t => tiers[t] != null)
      .map(t => ({ tier: t, count: tiers[t], prob: tiers[t] / total }));
  }

  /**
   * 省份分布（"你的省份今天抽到最多 XX"）
   */
  async function getProvinceStats() {
    let records;
    if (isSupabaseReady()) {
      try { records = await window.SupabaseConfig.fetchAllRecords(); }
      catch (e) { console.warn('[Repo] Supabase 读取失败，回退本地', e); }
    }
    if (!records) records = readGlobal();

    const map = {};
    for (const r of records) {
      const p = r.provinceName || '未知';
      if (!map[p]) map[p] = { province: p, count: 0, labels: {} };
      map[p].count++;
      map[p].labels[r.labelId] = (map[p].labels[r.labelId] || 0) + 1;
    }
    const arr = Object.values(map);
    // 每个省份找它抽到最多的标签
    arr.forEach(p => {
      let top = null, topN = 0;
      for (const [lid, n] of Object.entries(p.labels)) {
        if (n > topN) { topN = n; top = lid; }
      }
      p.topLabelId = top;
      p.topLabelDef = top ? Labels.get(top) : null;
      delete p.labels;
    });
    arr.sort((a, b) => b.count - a.count);
    return arr;
  }

  /**
   * 当前用户的标签图鉴（解锁了哪些）
   */
  function getUserCollection() {
    const hist = readHistory();
    const unlocked = new Set(hist.map(r => r.labelId));
    return Labels.all().map(def => ({
      def,
      unlocked: unlocked.has(def.id),
    }));
  }

  /**
   * 当前用户的历史记录
   */
  function getUserHistory() {
    return readHistory();
  }

  /**
   * 全局开盒总数（用于首页显示）
   */
  async function getTotalCount() {
    if (isSupabaseReady()) {
      try { return await window.SupabaseConfig.fetchTotalCount(); }
      catch (e) { /* fallthrough */ }
    }
    return readGlobal().length;
  }

  return {
    saveRecord,
    getTodayLabelStats,
    getRarityRanking,
    getProvinceStats,
    getUserCollection,
    getUserHistory,
    getTotalCount,
  };
})();

window.Repo = Repo;
