# 🔮 高考分数时光机

> 输入你当年的高考分数和全省排名，时光机算算放到 2026 年能上什么学校，开个盲盒看看你的专属称号。

**在线体验**：https://lyzbcy.github.io/gaokao-time-machine/

## ✨ 玩法

输入：省份 / 高考年份 / 科类（文理·物理历史·总分）/ 当年分数 / **全省排名** / 当年上的学校 / 专业名（选填）

输出：一个稀有度标签（SSR/SR/R/N + 2 个隐藏款），附带位次锚定换算说明和骚话评价。

## 🧠 核心机制：位次锚定

每年试题难度不同，同一分数的"含金量"年年变，但**全省排名稳定**。所以本网页用位次换算而非同分比较：

```
你当年 580 分 → 当年一分一段表 → 全省第 30000 名
                                ↓（同位次）
                  2026 一分一段表 → 2026 等位分 584 分
                                ↓
            用 584 分判定能上哪些学校 → 对比当年档次 → 出标签
```

## 📊 数据说明

- **覆盖**：10 省（川豫鲁粤苏鄂湘浙冀皖）× 105 校 × 2019-2025，梯队含 985/211/一本/二本
- **一分一段表**：当前为模型估算（幂函数 + 省控线锚点），可通过 `scripts/fetch-rank-data.js` 从官方源抓真实关键点位渐进式校准
- **2026 分数**：100% 模型预测
- ⚠️ **仅供娱乐，不是志愿填报工具**。任何升学决策请以各省教育考试院官方公告为准

详细声明见 [`docs/数据与预测说明.md`](docs/数据与预测说明.md)。

## 🎨 美术

表情包友情出演：**星星布丁 · 捞鱼 · 周三涵**（自有 IP）。映射表见 [`docs/素材对照表.md`](docs/素材对照表.md)。

## 🚀 本地预览

双击 `zeen-tools\一键启动前端.bat`（需 Node.js），自动开浏览器到 `http://127.0.0.1:8091/`。

详见 [`zeen-tools/本地预览说明.md`](zeen-tools/本地预览说明.md)。

## 🗂️ 项目结构

```
├── index.html              SPA 入口
├── css/                    样式（主样式/动效/响应式）
├── js/
│   ├── app.js              主应用（路由/开盒动效）
│   ├── config/supabase.js  可选云后端（未配置则用 localStorage）
│   ├── data/               scores.json + rank-tables.json + repository.js
│   ├── modules/            predictor / rank-converter / box-engine / labels / trash-talk / share-card
│   └── pages/              home / result / ranking / collection
├── img/                    表情包素材（来自微信表情包项目）
├── scripts/                爬虫 + OCR（渐进式校准真实数据）
├── docs/                   数据说明 / 素材对照表 / Supabase schema
├── generate-scores.js      学校数据生成器
├── generate-rank-tables.js 一分一段曲线生成器
├── copy-assets.js          美术资源复制脚本
├── local-preview-server.js 本地预览服务
└── zeen-tools/             一键启动/关闭/导航页
```

## 🔧 技术栈

- 原生 HTML/CSS/JS 单页 SPA（无框架、无构建，手机秒开）
- Supabase 云后端（可选，未配置自动回退 localStorage）
- zeen-tools 本地预览（中文路径兼容、端口自愈、Mobile 预览）

## ⚖️ 合规

- 数据爬虫只爬官方源（阳光高考、各省教育考试院）和教育聚合站，**不爬商业 AI 预测站**
- 表情包为自有 IP
- 本项目仅供娱乐，非商业志愿填报工具
