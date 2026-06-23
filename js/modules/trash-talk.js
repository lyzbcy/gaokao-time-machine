/* ===========================================================
 * trash-talk.js — 骚话评价模板库
 *
 * 每个标签配多条模板，随机抽 + 上下文拼接。
 * 风格：小红书/朋友圈口吻，活泼自嘲。
 * =========================================================== */

const TrashTalk = (function () {

  const TEMPLATES = {
    chosen_one: [
      '当年你的分能摸到{oldTier}的门，放到2026年直接掉到{newTier}，属于是{oldTier}的天选之子，可惜晚生了几年 😭',
      '这分数通胀率堪比津巴布韦，当年的{oldTier}水平现在只能看{newTier}了，建议穿越回去复读',
      '你是时间管理的受害者——再晚生几年，{oldTier}就变{newTier}了，血亏得明明白白',
    ],
    blood_loss: [
      '你这分数通货膨胀了属于是，当年稳进{oldTier}，现在只能{newTier}了 💸',
      '掉档掉得比我头发还快，{oldTier}→{newTier}，建议赶紧穿越回去复读',
      '同样是{score}分，当年{oldTier}随便挑，现在{newTier}都悬，时代变了大人',
      '你这波属于是"反向躺赢"，别人躺赢升档，你躺平掉档，{oldTier}变{newTier}',
    ],
    era_bonus: [
      '哇哦！当年{oldTier}的水平，放到2026年直接升到{newTier}，你赢麻了！🎉',
      '这波是站在时代风口上，{oldTier}→{newTier}，建议立刻穿越过去享福',
      '同样是{score}分，你这是越活越值钱，{oldTier}升到{newTier}，躺赢典范',
      '凡尔赛本赛了属于是，当年{oldTier}现在{newTier}，建议你请全班吃饭',
    ],
    early_bird: [
      '幸好你考得早！当年能上的学校，2026年分更高了，你这波属于是抢到了时代的早鸟票 🎫',
      '你当年选的学校现在涨分了， hindsight 一下你眼光还挺准的',
      '这学校现在分比你当年还高，你是真的赶上了好时候',
      '早考早享受，晚考uum…晚考只能看着分数干瞪眼',
    ],
    lucky_king: [
      '刚好压线进{oldTier}，你这运气是攒了多久？建议立刻去买彩票 🍀',
      '压线进的含金量！{oldTier}的门缝刚好够你挤进去，锦鲤本鲤',
      '这波属于是"卡点王者"，差一分就掉档，建议给阅卷老师磕一个',
      '压线录取，运气守恒定律马上要生效了，接下来请低调做人',
    ],
    nothing_special: [
      '平平无奇的一个分数，放到2026年也还是那个味儿，稳如老狗 🐶',
      '岁月静好，档次没变，你这分数抗通胀能力挺强',
      '不升不降，主打一个陪伴，{oldTier}还是那个{oldTier}',
      '你是分数界的国债，稳健得让人放心，{oldTier}纹丝不动',
    ],
    declining: [
      '一代不如一代了属于是，{oldTier}小幅掉到{newTier}，建议给孩子多吃点核桃 📉',
      '档次轻微下滑，不是你的问题，是时代卷得厉害',
      '虽然只掉了一档，但每掉一档都是真金白银的痛',
      '{oldTier}→{newTier}，这波是温水煮青蛙式掉档',
    ],
    tuition_inflation: [
      '分掉了，换个档次低的学校，结果发现学费还更贵了，双倍暴击 💸',
      '你以为掉档只是学校变差？天真，学费还在原地等你甚至更高',
      '分数通胀 + 学费通胀，双重快乐，建议直接打工',
      '这波是"分数贬值，学费升值"，血亏战神候选人了属于是',
    ],

    // 隐藏款
    parallel_universe: [
      '🦄 检测到时空裂缝…在平行宇宙里，你的{score}分能让{oldTier}大学倒贴钱请你入学',
      '🦄 警告：你已进入平行宇宙。这里{oldTier}是野鸡，{newTier}才是清北',
      '🦄 恭喜触发隐藏款！在另一个宇宙，你的分数能买到彩票头奖',
    ],
    time_paradox: [
      '🔮 警告：你输入了一个不该存在的年份。时间线已崩溃，请勿尝试修复。',
      '🔮 时空悖论触发！你确定你是从{year}年穿越来的吗？',
      '🔮 检测到非法时间戳，AI已报警，建议立刻自首',
    ],
  };

  const TIER_CN = { '985': '985', '211': '211', '1': '一本', '2': '二本' };

  function fill(tpl, ctx) {
    return tpl
      .replace(/{score}/g, ctx.input?.score ?? '??')
      .replace(/{year}/g, ctx.input?.year ?? '????')
      .replace(/{oldTier}/g, TIER_CN[ctx.oldTier] || ctx.oldTier || '??')
      .replace(/{newTier}/g, TIER_CN[ctx.newTier] || ctx.newTier || '??');
  }

  /**
   * 根据结果生成骚话
   * @param {Object} result box-engine 返回的结果
   * @returns {string}
   */
  function generate(result) {
    const labelId = result.label.id;
    const pool = TEMPLATES[labelId] || TEMPLATES.nothing_special;
    const tpl = pool[Math.floor(Math.random() * pool.length)];
    return fill(tpl, result);
  }

  return { generate };
})();

window.TrashTalk = TrashTalk;
