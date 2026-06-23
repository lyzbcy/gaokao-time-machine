/* ===========================================================
 * supabase.js — Supabase 客户端封装（可选后端）
 *
 * 使用方式：
 *   1. 把下面 SUPABASE_URL 和 SUPABASE_ANON_KEY 填上你的项目凭据
 *   2. 在 Supabase 后台执行 docs/supabase-schema.sql 建表
 *   3. 刷新页面，网页自动启用真实多用户数据
 *
 * 未填 / 留空时，repository.js 会自动回退 localStorage 单机版，
 * 全部功能仍可正常使用（只是排行榜是单机数据）。
 *
 * 加载 supabase-js：通过 CDN 引入，window.supabase 全局可用。
 * =========================================================== */

const SupabaseConfig = (function () {

  // ====== 在这里填你的 Supabase 凭据 ======
  const SUPABASE_URL = '';        // 例：'https://xxxxx.supabase.co'
  const SUPABASE_ANON_KEY = '';   // 例：'eyJhbGciOi...'
  // ========================================

  const TABLE = 'box_records';
  let client = null;
  let ready = false;
  let initError = null;

  // 动态加载 supabase-js CDN
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function init() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.info('[Supabase] 未配置凭据，使用 localStorage 单机模式。填 js/config/supabase.js 后启用云端。');
      return false;
    }
    try {
      if (!window.supabase) {
        await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
      }
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      ready = true;
      console.info('[Supabase] 已连接，启用云端多用户数据。');
      return true;
    } catch (e) {
      initError = e;
      console.warn('[Supabase] 初始化失败，回退本地：', e);
      return false;
    }
  }

  function isReady() { return ready && client; }

  // ---------- CRUD ----------

  async function insertRecord(record) {
    const { error } = await client.from(TABLE).insert({
      label_id: record.labelId,
      label_name: record.labelName,
      tier: record.tier,
      province: record.province,
      province_name: record.provinceName,
      exam_year: record.year,
      score: record.score,
      rank: record.rank || null,
      track: record.track || null,
      track_label: record.trackLabel || null,
      major: record.major || null,
      equivalent_score_2026: record.equivalentScore2026 || null,
      created_at: new Date(record.timestamp || Date.now()).toISOString(),
    });
    if (error) throw error;
  }

  async function fetchTodayRecords() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data, error } = await client.from(TABLE)
      .select('label_id,label_name,tier,province,province_name,created_at')
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) throw error;
    return (data || []).map(r => ({
      labelId: r.label_id,
      labelName: r.label_name,
      tier: r.tier,
      province: r.province,
      provinceName: r.province_name,
      timestamp: new Date(r.created_at).getTime(),
    }));
  }

  async function fetchAllRecords() {
    const { data, error } = await client.from(TABLE)
      .select('label_id,tier,province,province_name,created_at')
      .order('created_at', { ascending: false })
      .limit(2000);
    if (error) throw error;
    return (data || []).map(r => ({
      labelId: r.label_id,
      tier: r.tier,
      province: r.province,
      provinceName: r.province_name,
      timestamp: new Date(r.created_at).getTime(),
    }));
  }

  async function fetchTotalCount() {
    const { count, error } = await client.from(TABLE)
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count || 0;
  }

  return {
    init, isReady,
    insertRecord, fetchTodayRecords, fetchAllRecords, fetchTotalCount,
    _status: () => ({ ready, initError, configured: !!SUPABASE_URL }),
  };
})();

window.SupabaseConfig = SupabaseConfig;
