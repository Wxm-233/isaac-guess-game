# 撒一把 · 本地单人 Demo

以“弗一把”的逐列属性反馈玩法为参考，猜测《以撒的结合：忏悔+》的道具。

## 启动

需要 Node.js 20 或更新版本，运行时没有第三方依赖，无需 `npm install`。

```bash
npm run dev
```

打开 **http://localhost:5173**。关闭服务可在运行终端按 `Ctrl+C`。

Windows 也可以双击 `启动Demo.cmd`。Linux / WSL 可运行 `bash start-demo.sh`；该脚本会优先使用系统 Node，或本次 Demo 已准备的临时 Node 运行时。

自定义端口：Linux / WSL 下使用 `PORT=5174 npm run dev`；PowerShell 下使用 `$env:PORT=5174; npm run dev`。

## GitHub Pages 部署

项目已包含 `.github/workflows/pages.yml`。工作流先运行测试，再将 `public/` 发布到 Pages，无需安装项目依赖或运行 Node 服务。页面和资源路径兼容仓库子路径。

1. 在 GitHub 新建一个空仓库，例如 `isaac-guess-game`。免费个人账户可使用公开仓库。
2. 进入仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
3. 将本项目推送到该仓库的 `main` 分支。首次初始化时，在项目目录执行以下命令，将 `YOUR_USERNAME` 替换为你的用户名：

   ```bash
   git init
   git add .
   git commit -m "Add Isaac guessing game"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/isaac-guess-game.git
   git push -u origin main
   ```

4. 在 **Actions → Deploy to GitHub Pages** 查看结果。完成后访问 `https://YOUR_USERNAME.github.io/isaac-guess-game/`，实际地址也会显示在 Settings → Pages。

如果先推送后启用 Pages，可在 Actions 中点击 **Run workflow** 重新部署。以后每次向 `main` 推送都会自动更新。项目使用浏览器本地存档，线上站点会有独立于 localhost 的进度和战绩。

若使用现有仓库，请沿用它的 Git 历史与远程配置，不重复初始化；该工作流会替换该仓库现有的 Pages 站点内容。

## 已实现

- 717 件忏悔+图鉴道具、本地图标和中文名称，无运行时外部数据请求。
- 每局随机答案、8 次机会、揭晓答案、换一局。
- 中文 / 常用俗称 / 英文 / 拼音 / 首字母 / ID 搜索及键盘选择。
- 品质、主动/被动/跟班、普通模式道具池、标签、充能、解锁方式的比较。道具池和标签逐项显示 ✓ / ×。
- ID 相差 1 的彩蛋提示。
- 浏览器本地进度恢复、完成局数、胜率、最佳次数及无答案的战绩复制。
- 桌面布局随屏幕放大；手机端按多行属性卡片展示，无需横向滚动。

数据属性采用忏悔+ 1.9.7.17（J460）的原版配置。无账户、服务器战绩或多人模式。答案与数据保存在浏览器中，适合本地单人体验。

## 数据

详见 [SOURCES.md](SOURCES.md)。`data/raw/` 保留上游快照，`data/aliases.json` 维护俗称，`data/pinyin.json` 保留生成好的拼音索引，`public/data/items.json` 是游戏实际使用的题库。

本次升级涉及 186 件道具：143 件品质、17 件道具池、5 件主题标签、6 件充能、30 件中文说明发生变化（分类有重叠）。完整前后差异见 [更新记录](data/repentance-plus-update.json)。升级后旧版本的进行中对局会重开，累计战绩保留。

重新生成题库（Python 3，仅标准库）：

```bash
python3 scripts/build_data.py
```

中文说明按 EID 基础说明 → 忏悔 → 忏悔+ 的顺序覆盖合并，只在结束后展示。俗称是当前 Demo 的小规模补充表，未合并完整 Wiki 关键词表。标签展示 19 种主题分类；空集合表示“无所列标签”。普通模式所有已收录道具池参与比较，每一项单独标记；两组集合都为空也视为匹配。解锁方式分为不需要解锁、指定角色（表/里）和其他解锁条件；同角色但表里不同显示黄色。

## 验证

```bash
npm test
```

测试包括题库完整性、本地图标、集合判定、充能类型、搜索、重复猜测、胜负及存档校验。

可选浏览器测试需另行安装 Playwright / Chromium，并先启动 Demo：

```bash
node tests/browser.mjs
```

也可通过 `PLAYWRIGHT_MODULE` 指定 Playwright 的模块绝对路径，`DEMO_URL` 指定测试地址，`SCREENSHOT_DIR` 指定截图目录。测试使用隔离浏览器上下文，不修改玩家的实际进度。

## 文件结构

```text
public/             页面、样式、游戏逻辑、题库和图标
scripts/build_data.py 数据整合脚本
data/               来源快照和拼音索引
server.mjs          零依赖本地静态服务
tests/              判定与浏览器流程验证
```
