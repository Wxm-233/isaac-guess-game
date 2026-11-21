# 数据来源与整理口径

本 Demo 独立编写界面和游戏代码，玩法参考 [shnlfriberg/csgofriberg](https://github.com/shnlfriberg/csgofriberg)。未复制该仓库的实现代码。

基础数据采集于 2026-11-17，2026-11-18 更新为 **忏悔+ 1.9.7.17.J460**。保留原始文件，并在 `data/source-manifest.json` 记录来源、资源包 SHA-256、快照 SHA-256 和统一 LF 换行后的 SHA-256。

| 本地文件 | 上游 | 用途 |
| --- | --- | --- |
| `data/raw/items.xml` | 本机原版忏悔+资源包 | 道具类型、隐藏标记、充能、解锁成就 |
| `data/raw/items_metadata.xml` | 本机原版忏悔+资源包 | 同版本品质与标签 |
| `data/raw/itempools.xml` | 本机原版忏悔+资源包 | 同版本道具池；不导入 greed 开头的贪婪模式池 |
| `data/raw/achievements.json` | [Isaac Completion Tracker / 成就条件快照](https://github.com/reiassezbeau/isaac-completion-tracker/blob/26643549ba1560940b31535f45f54931fa2aee63/src-tauri/resources/achievements.json) | 关联成就 ID，识别指定角色和表/里 |
| `data/raw/names_zh.lua` | [EID / 中文名称](https://github.com/wofsauge/External-Item-Descriptions/blob/master/descriptions/names/zh_cn.lua) | 中英文名称 |
| `data/raw/descriptions_base_zh.lua` | [EID / 胎衣+中文描述](https://github.com/wofsauge/External-Item-Descriptions/blob/master/descriptions/ab%2B/zh_cn.lua) | 基础中文效果说明 |
| `data/raw/descriptions_zh.lua` | [EID / 忏悔中文描述](https://github.com/wofsauge/External-Item-Descriptions/blob/master/descriptions/rep/zh_cn.lua) | 覆盖基础说明中的版本差异 |
| `data/raw/descriptions_repplus_zh.lua` | [EID / 忏悔+中文描述（固定提交）](https://github.com/wofsauge/External-Item-Descriptions/blob/993c881e0e52e08e1e8e87fcc068625961dcbd1a/descriptions/rep%2B/zh_cn.lua) | 最后覆盖忏悔+的效果改动 |
| `data/raw/community_items.json` | [Bindings-of-Isaac-Cheat-Sheet](https://github.com/Swashua/Bindings-of-Isaac-Cheat-Sheet/blob/main/data/items.json) | 图标路径映射；属性比较不使用此文件 |
| `public/assets/items/*.png` | [Cheat Sheet / 道具图标](https://github.com/Swashua/Bindings-of-Isaac-Cheat-Sheet/tree/main/public/images/items) | 本地图标，原游戏资源权利归原权利人 |
| `data/pinyin.json` | pinyin-pro 生成 | 中文名称全拼及首字母，运行时不依赖该库 |

游戏版本由本机日志中的 `Binding of Isaac: Repentance+ v1.9.7.17.J460` 核实。使用游戏附带的 Linux ResourceExtractor 从 `resources/packed/afterbirthp.a` 提取 `resources/items.xml`、`resources/items_metadata.xml` 和 `resources/itempools.xml`，不使用 mods 中的配置。`repentance.a` 中的旧忏悔配置不作为本次数据源。已保存提取结果，因此重新构建题库无需安装游戏。

2026-11-18 首次升级与旧题库相比，186 件道具至少一个字段变化：143 件品质、17 件道具池、5 件主题标签、6 件充能、30 件中文说明；其中说明变化包含忏悔+覆盖、空白格式解析修正和品质图标转文字。逐项前后值见 `data/repentance-plus-update.json`。

717 件道具通过游戏配置筛选：保留 active / passive / familiar，排除 hidden=true 的 59、656、714、715。所有字段按稳定道具 ID 合并。图标的质量、名称等不参与游戏判定。

展示标签（19 类）：嗝屁猫、书本、妈妈、蘑菇、针筒、苍蝇、宝宝、天使、恶魔、鲍勃、蜘蛛、便便、食物、科技、电池、死亡、星星、任务、攻击性。它们来源于配置标签，不等价于完整套装判定。

计时充能按每秒 30 帧换算显示；特殊充能只比较机制类别；普通 0 充能显示“无充能条”，不推断是否一次性。解锁字段以游戏 `items.xml` 的 achievement ID 为准，关联 `data/raw/achievements.json` 的完整条件文本，分为 `none`（无需解锁）、`character`（角色及表/里）、`other`（其他条件）。只识别条件末尾明确的 `as <角色>`，不把被击败的头目或泛指的 Isaac 当作解锁角色。所有角色完成标记、挑战、累计次数等归入其他条件；表雅各与以扫与里雅各归为同一角色组。

2026-11-21 添加 `offensive` → 攻击性，直接读取本地游戏配置，覆盖 546 件道具。解锁分类为 444 件无需解锁、178 件指定角色、95 件其他条件。本地 achievements.xml 的部分条件为空、为 ???，以及含有旧注释，因此角色分类采用固定提交的成就条件快照；不使用上游自动推断的 character 字段（例如它把 every character 误识别成 Eve）。

道具池和标签按所猜道具的每个条目独立显示 ✓/×，不展示答案独有的条目。集合整体状态仍用于提示是否列全及分享战绩。解锁方式同类别匹配；角色相同但表里不同为黄色，不同角色为灰色。

Wiki 的 Item.tabx、ItemKeywords.tabx、Itempool_rep.tabx 和 Achievement.tabx 已确认存在，但本次数据请求返回 403，未将其内容声明为已导入。后续可替换数据构建步骤，合并更多译名、俗称和拼音索引。

本目录为本地演示保留数据来源快照；第三方文本与游戏素材继续适用各自的权利和使用条件。
