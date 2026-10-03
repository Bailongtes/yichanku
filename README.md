# 野人遗产库 · The Savage Legacy Archive

> 残卷纪年 · 一切归于尘土的,终将被再次拾起

一个**纯静态**的游戏百科图鉴库网站。零依赖、零构建步骤,原生 HTML / CSS / JavaScript 实现,直接部署到 GitHub Pages 即可访问。

## 特性

- **分类浏览** —— 怪物图鉴 / 遗物志 / 秘术残章 / 失落之地 / 人物志 / 纪年残卷
- **全文搜索** —— 覆盖条目名、英文名、标签、描述、纪年正文、出没地、掉落物
- **标签交叉筛选** —— 侧栏标签云,可与分类叠加过滤
- **详情页** —— 属性评定条、纪年残卷正文、弱点、掉落、相关条目推荐
- **暗色奇幻视觉** —— 羊皮纸质感、暗金配色、稀有度色阶、卷轴式动效
- **响应式** —— 移动端抽屉式目录
- **快捷键** —— `/` 聚焦搜索,`Esc` 清除

## 本地预览

因为数据通过 `fetch` 加载,需用本地 HTTP 服务打开(直接双击 `index.html` 走 `file://` 会被浏览器同源策略拦截):

```bash
# 方式一:Python(系统自带)
python -m http.server 8000

# 方式二:Node
npx serve .
```

然后访问 <http://localhost:8000>。

## 部署到 GitHub Pages

### 方式一:GitHub Actions(仓库已内置,推荐)

1. 在 GitHub 新建仓库,把本目录所有文件推上去:

   ```bash
   git init
   git add .
   git commit -m "feat: 野人遗产库 init"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/<仓库名>.git
   git push -u origin main
   ```

2. 进入仓库 **Settings → Pages**,在 **Build and deployment → Source** 选择 **GitHub Actions**。
3. 推送后 Actions 会自动构建并发布,稍等片刻即可访问:

   ```
   https://<你的用户名>.github.io/<仓库名>/
   ```

### 方式二:直接指定分支目录

**Settings → Pages → Source** 选择 `Deploy from a branch`,分支选 `main`、目录选 `/ (root)`,保存即可。仓库中的 `.nojekyll` 已确保静态资源不被 Jekyll 处理。

## 内容维护

所有条目存放在 `data/entries.json`,结构如下:

```jsonc
{
  "meta":       { "title": "...", "subtitle": "...", "tagline": "...", "intro": "..." },
  "categories": [ { "id": "bestiary", "name": "怪物图鉴", "en": "Bestiary", "glyph": "🐺", "desc": "..." } ],
  "entries": [
    {
      "id": "bonegnasher",          // 唯一标识,用于 URL
      "name": "噬骨者",              // 中文名
      "en": "Bonegnasher",          // 英文名
      "category": "bestiary",       // 对应 categories 的 id
      "rarity": "legendary",        // common | uncommon | rare | epic | legendary | mythic
      "glyph": "🦴",                 // 卡片/详情页显示的字形或 emoji
      "tags": ["荒原", "不死"],
      "desc": "一句话简介",
      "lore": ["正文段落一", "正文段落二"],
      "stats": [ { "label": "威胁等级", "value": 82 } ],
      "weakness": "弱点说明",
      "drops": ["掉落物 A", "掉落物 B"],
      "habitat": "出没地",
      "related": ["其他条目的 id"]     // 可选,不填则自动取同分类
    }
  ]
}
```

**添加新条目**:往 `entries` 数组里追加一个对象即可,无需改任何代码。
**新增分类**:在 `categories` 里加一条,并在条目的 `category` 中引用它的 `id`。

## 目录结构

```
白龙皇网站/
├── index.html                  # 页面骨架
├── assets/
│   ├── css/style.css           # 设计系统与全部样式
│   └── js/app.js               # 路由、搜索、筛选、渲染逻辑
├── data/entries.json           # 全部图鉴内容(编辑这里即可扩充)
├── .github/workflows/deploy.yml# GitHub Actions 自动部署
├── .nojekyll                   # 禁用 Jekyll 处理
└── README.md
```

## 许可

内容与代码仅供学习与个人使用。
