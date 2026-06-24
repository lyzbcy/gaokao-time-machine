/* ===========================================================
 * box-engine.js — 盲盒引擎
 *
 * 职责：
 *   1. 根据用户输入（省份、年份、分数、当年选择）算出"当年档次"与"2026同分档次"
 *   2. 判定命中哪些标签
 *   3. 在命中集合中按显示概率加权随机抽出一个
 *   4. 返回完整结果（标签 + 对比数据 + 用于评价的上下文）
 *
 * 判定优先级：
 *   隐藏款触发条件 > 命中常规标签 > 兜底（平平无奇/一代不如一代）
 * =========================================================== */

const BoxEngine = (function () {

  // 档次排序权重（用于算"掉了多少档"）
  const TIER_RANK = { '985': 4, '211': 3, '1': 2, '2': 1 };
  const TIER_LIST = ['2', '1', '211', '985']; // 升序

  /**
   * 给定分数，找出该省该年"刚好能进的最高档次"
   * （即：分数 >= 该档次代表校的录取分 的最高梯队）
   */
  function tierForScore(score, provinceData, year, predicted = false) {
    if (!provinceData || !provinceData.schools) return null;
    // 对每所学校算它在这一年的录取分（predicted=true 时用 2026 预测分）
    let bestTier = null;
    let bestTierRank = 0;
    for (const sch of provinceData.schools) {
      let schScore;
      if (predicted) {
        const p = Predictor.predictSchool(sch, year);
        schScore = p.predicted2026;
      } else {
        schScore = sch.scores[year];
      }
      if (schScore == null) continue;
      if (score >= schScore) {
        const r = TIER_RANK[sch.tier] || 0;
        if (r > bestTierRank) {
          bestTierRank = r;
          bestTier = sch.tier;
        }
      }
    }
    return bestTier;
  }

  /**
   * 找到该分数在该省该年"能上的代表学校"（用于结果页展示）
   * 返回：分数 ±30 范围内、且分数 >= 录取分 的学校列表（取最近的几所）
   */
  function schoolsForScore(score, provinceData, year, predicted = false, limit = 5) {
    if (!provinceData || !provinceData.schools) return [];
    const list = [];
    for (const sch of provinceData.schools) {
      let schScore;
      if (predicted) {
        const p = Predictor.predictSchool(sch, year);
        schScore = p.predicted2026;
      } else {
        schScore = sch.scores[year];
      }
      if (schScore == null) continue;
      // 只看分数 ±30 内、且用户分数 >= 录取分（即"能上"）
      if (score >= schScore && (score - schScore) <= 30) {
        list.push({
          name: sch.name,
          tier: sch.tier,
          cutoff: schScore,
          gap: score - schScore,
        });
      }
    }
    list.sort((a, b) => a.gap - b.gap); // 越接近压线越靠前（捡漏感）
    return list.slice(0, limit);
  }

  /**
   * 加权随机抽一个标签
   * @param {Array} candidates [{def, weight}]
   */
  function weightedPick(candidates) {
    const total = candidates.reduce((s, c) => s + c.weight, 0);
    let r = Math.random() * total;
    for (const c of candidates) {
      r -= c.weight;
      if (r <= 0) return c.def;
    }
    return candidates[candidates.length - 1].def;
  }

  /**
   * 判定隐藏款彩蛋
   */
  function checkEasterEgg(input) {
    // 时空悖论：年份 >= 2026（用户在选 2026 当"当年"）
    if (input.year >= 2026) {
      return Labels.get('time_paradox');
    }
    // 平行宇宙：分数极端 + 特定省份年份组合（命中率约 0.5%）
    // 用一个 hash 决定，保证"看着随机但有触发感"
    if (input.score >= 690 || input.score <= 430) {
      const hash = (input.province.charCodeAt(0) + input.year + input.score) % 97;
      if (hash < 3) return Labels.get('parallel_universe');
    }
    // 纯随机小概率触发平行宇宙（额外 0.3%）
    if (Math.random() < 0.003) return Labels.get('parallel_universe');
    return null;
  }

  /**
   * 主入口：开盒（V2 位次锚定版）
   * @param {Object} input {
   *   province, provinceName, year, score,         // 必填：当年分数
   *   rank, track,                                  // 必填：全省排名 + 科类(science/arts/physics/history/general)
   *   chosenSchool?, chosenTier?, major?            // 选填：当年上的学校/档次/专业名(仅展示)
   * }
   * @param {Object} provinceData 该省数据（来自 scores.json）
   * @returns {Object} 完整结果
   */
  function open(input, provinceData) {
    const TARGET = 2026;

    // 0. 位次锚定换算：直接用用户输入的真实全省排名换算 2026 等位分
    //    ⚠️ 信任用户输入的 rank，绝不用模型反查覆盖（反查会被曲线误差污染）
    let equivalentScore2026 = input.score; // 兜底：换算失败时退化为同分
    let conversion = null;
    if (window.RankConverter && input.rank && input.track) {
      conversion = RankConverter.convertByRank(
        input.rank, input.province, input.year, input.track, TARGET
      );
      if (conversion && conversion.equivalentScore != null) {
        equivalentScore2026 = conversion.equivalentScore;
      }
    }

    // 判定基准分：优先用专业分（用户填了就按专业判），否则用总分
    const oldJudgeScore = input.majorScore || input.score;
    const newJudgeScore = input.majorScore
      ? (input.majorScore - input.score + equivalentScore2026) // 专业分跟随等位分平移
      : equivalentScore2026;

    // 1. 算当年档次
    let oldTier;
    const knownSch = input.chosenSchool ? provinceData.schools.find(s => s.name === input.chosenSchool) : null;
    if (input.chosenTier) {
      oldTier = input.chosenTier;
    } else if (knownSch) {
      oldTier = knownSch.tier; // 列表内校：用已知档次
    } else {
      oldTier = tierForScore(oldJudgeScore, provinceData, input.year); // 自定义校或未填：按分推断
    }

    // 2. 算 2026 档次
    let newTier;
    if (input.chosenSchool && input.custom2026 != null) {
      // 自定义校：用户录入的2026分直接决定能否上（>= 能上，按 custom2026 所处档次定）
      newTier = tierForScore(input.custom2026, provinceData, TARGET, true);
      // 若等位分 >= custom2026，说明今年同位次还能上这校（档次不变）；否则掉档
      if (newJudgeScore < input.custom2026) {
        // 今年同位次分不够该校，按等位分推断能上的档次
        newTier = tierForScore(newJudgeScore, provinceData, TARGET, true);
      }
    } else if (knownSch) {
      // 列表内校：看等位分是否还够该校2026预测分
      const p = Predictor.predictSchool(knownSch, TARGET);
      if (p.predicted2026 != null && newJudgeScore >= p.predicted2026) {
        newTier = knownSch.tier; // 还能上，档次不变
      } else {
        newTier = tierForScore(newJudgeScore, provinceData, TARGET, true);
      }
    } else {
      newTier = tierForScore(newJudgeScore, provinceData, TARGET, true);
    }

    // 3. 档次变化
    const oldRank = TIER_RANK[oldTier] || 0;
    const newRank = TIER_RANK[newTier] || 0;
    const tierDelta = newRank - oldRank; // 正=升档，负=掉档

    // 4. 当年能上的学校在 2026 的预测分（判断"通胀"）—— 用等位分比较
    const oldSchools = schoolsForScore(input.score, provinceData, input.year, false, 3);
    let inflated = false;
    if (oldSchools.length > 0) {
      const anyHigher = oldSchools.some(s => {
        const sch = provinceData.schools.find(x => x.name === s.name);
        if (!sch) return false;
        const p = Predictor.predictSchool(sch, TARGET);
        return p.predicted2026 != null && p.predicted2026 > equivalentScore2026;
      });
      inflated = anyHigher;
    }

    // 5. 是否刚好压线（gap <= 5）
    const justQualified = oldSchools.length > 0 && oldSchools[0].gap <= 5;

    // 6. 2026 能上的代表学校（用等位分筛选，用于展示）
    const newSchools = schoolsForScore(equivalentScore2026, provinceData, TARGET, true, 5);

    const context = {
      input,
      oldTier,
      newTier,
      tierDelta,
      oldRank,
      newRank,
      inflated,
      justQualified,
      oldSchools,
      newSchools,
      // V2 新增：位次锚定换算结果（透传给前端展示）
      equivalentScore2026,
      conversion,
      provinceRank: input.rank, // 全省位次：直接用用户输入的真实值
      track: input.track,
      // 专业分判定（V3）：用户填了专业分则按专业判
      judgeByMajor: !!input.majorScore,
      oldJudgeScore,
      newJudgeScore,
      // 自定义校（V3）：用户录入的2026分
      customSchool: !!(input.chosenSchool && input.custom2026 != null),
      customSchoolName: input.chosenSchool,
      custom2026: input.custom2026,
    };

    // 7. 先查隐藏款
    const egg = checkEasterEgg(input);
    if (egg) {
      return finalize(egg, context);
    }

    // 8. 收集命中的常规标签
    const matched = [];
    for (const def of Labels.visible()) {
      const c = def.cond;
      let hit = false;
      if (c.type === 'tier_drop' && tierDelta <= -c.min) hit = true;
      else if (c.type === 'tier_rise' && tierDelta >= c.min) hit = true;
      else if (c.type === 'score_inflation' && inflated) hit = true;
      else if (c.type === 'just_qualified' && justQualified) hit = true;
      else if (c.type === 'tier_stable' && tierDelta === 0) hit = true;

      if (hit) matched.push({ def, weight: def.displayProb });
    }

    let chosen;
    if (matched.length > 0) {
      chosen = weightedPick(matched); // weightedPick 已返回 def 本身
    } else {
      // 兜底：平平无奇
      chosen = Labels.get('nothing_special');
    }

    return finalize(chosen, context);
  }

  function finalize(def, context) {
    return {
      label: def,
      ...context,
      // 真实出现概率（用于显示"你这个标签出现概率 X%"）
      appearanceProb: def.displayProb,
      timestamp: Date.now(),
    };
  }

  return { open, tierForScore, schoolsForScore };
})();

window.BoxEngine = BoxEngine;
