/* ===========================================================
 * about.js — 关于作者页
 *
 * 参考作者主页 lyzbcy.github.io/about/ 的调性：
 * IP 名「捞鱼」、slogan「一个弱小但有梦想的开发者」、捞鱼工作室。
 * =========================================================== */

const AboutPage = (function () {

  function render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <section class="about-hero">
        <img class="about-avatar" src="img/labels/xuekui.png" alt="捞鱼"
             onerror="this.src='img/ui/logo.png'">
        <div class="about-name">捞鱼 🐟</div>
        <div class="about-slogan">一个弱小但有梦想的开发者</div>
        <span class="about-studio">捞鱼工作室</span>
      </section>

      <section class="card">
        <div class="about-bio">
          嗨，我是 <b>捞鱼</b>，一个在代码和创意之间反复横跳的独立开发者。<br><br>
          做「高考分数时光机」的初衷很简单——想给大学生一个会心一笑的小东西：把你当年的分数换算到今天，开个盲盒，看看时光这把杀猪刀到底对你做了什么 😂。<br><br>
          里面的表情包都来自我自己的 IP：<b>星星布丁</b>、<b>捞鱼</b>、<b>周三涵</b>，算是一点点私心，想顺便推广一下我的小家伙们。
        </div>

        <div class="ip-grid mt-16">
          <div class="ip-cell"><div class="ip-emoji">🍮</div><div class="ip-name">星星布丁</div></div>
          <div class="ip-cell"><div class="ip-emoji">🐟</div><div class="ip-name">捞鱼</div></div>
          <div class="ip-cell"><div class="ip-emoji">😎</div><div class="ip-name">周三涵</div></div>
        </div>
      </section>

      <h2 class="section-title">🔗 找到我</h2>
      <section class="card">
        <a class="about-link-btn" href="https://lyzbcy.github.io/about/" target="_blank" rel="noopener">
          🏠 作者主页（项目展示 / 技术积累）
        </a>
        <a class="about-link-btn" href="javascript:void(0)" onclick="App.openQq()" style="background:linear-gradient(135deg,#12B7F5,#0D8BD9);box-shadow:0 6px 16px rgba(18,183,245,0.35)">
          💬 加入 QQ 群（反馈/补数据/聊天）
        </a>
        <a class="about-link-btn ghost" href="javascript:void(0)" onclick="App.openReward()">
          ☕ 请我喝杯咖啡（赞赏）
        </a>
      </section>

      <h2 class="section-title">📜 关于这个项目</h2>
      <section class="card">
        <div class="about-bio">
          <b>高考分数时光机</b> 是一个纯娱乐网页，<b>不是志愿填报工具</b>。<br><br>
          一分一段表已接入<b>各省教育考试院真实数据</b>（教育在线转载，17省覆盖），其余用锚点校准模型。任何升学决策请以各省教育考试院官方公告为准。<br><br>
          技术栈：原生 HTML/CSS/JS 单页应用 + 位次锚定换算 + Supabase 云后端 + 懒加载架构。<br>
          数据：全国 31 省 × 638 所院校 × 2019-2025，含 91 张真实一分一段表。
        </div>
      </section>

      <p class="muted text-center mt-16 mb-16">
        🎨 表情包友情出演：星星布丁 · 捞鱼 · 周三涵<br>
        Made with ❤️ by 捞鱼工作室
      </p>
    `;
  }

  return { render };
})();

window.AboutPage = AboutPage;
