# scripts · 数据脚本

本项目含以下数据脚本，用于生成/抓取/校准高考数据。

## 脚本清单

| 脚本 | 用途 | 何时运行 |
|------|------|----------|
| `../generate-scores.js` | 生成学校录取分数线（10省×30校×7年） | 重置学校数据时 |
| `../generate-rank-tables.js` | 生成各省一分一段曲线（模型版，MVP用） | 重置位次数据时 |
| `../copy-assets.js` | 从微信表情包复制美术资源 | 替换素材时 |
| `fetch-rank-data.js` | 爬真实一分一段表关键点位（省控线/特控线） | 渐进式校准时 |
| `ocr-keypoints.js` | 对图片/PDF 一分一段表做 OCR 提取关键点位 | fetch 遇到图片格式时 |

## 数据分层（理解精度来源）

```
学校录取线  → generate-scores.js 生成（代表性估算）
位次锚点    → generate-rank-tables.js 生成（模型估算）
              ↑ fetch-rank-data.js / ocr-keypoints.js 逐步用真实值替换
```

## 渐进式校准流程（推荐）

1. **MVP 阶段**：只跑 `generate-scores.js` + `generate-rank-tables.js`，纯模型数据，立即可用
2. **校准阶段**：跑 `node fetch-rank-data.js` 抓各省省控线/特控线（HTML 文本提取）
3. **深度校准**：对图片/PDF 格式的表，下载后跑 `node ocr-keypoints.js <路径>` OCR 提取
4. 每次抓取/OCR 的关键点位会覆盖 `js/data/rank-tables.json` 对应锚点，换算精度持续提升

## 合规边界 ⚠️

**✅ 允许抓取**：
- 阳光高考（chsi.com.cn，教育部官方）
- 各省教育考试院官网
- 教育在线（eol.cn）、高考在线等**转载政府数据**的聚合站

**❌ 禁止抓取**：
- 掌上高考、夸克高考等**商业 AI 预测站**（避免侵权/不正当竞争）

**抓取规则**：
- 遵守 robots.txt
- 请求间隔 ≥ 2 秒（fetch-rank-data.js 已内置）
- 标注数据来源（写入 rank-tables.json 的 source 字段）
- 仅供娱乐，非商业志愿填报工具

## OCR 注意事项

- OCR 识别错率非零，故**只 OCR 关键点位**（省控线/特控线/几个高分段），不做全表 OCR
- OCR 结果建议人工核对后再写回
- 依赖：`npm install tesseract.js`（首次运行会下载中文语言包约 10-30MB）

## 风险提示

- 各省考试院网站结构会变化，`fetch-rank-data.js` 的解析器需定期维护
- 部分省份历史数据已下线，可能抓不到，此时保持模型值
- 真实运行爬虫前，建议先人工核对各省页面可达性
