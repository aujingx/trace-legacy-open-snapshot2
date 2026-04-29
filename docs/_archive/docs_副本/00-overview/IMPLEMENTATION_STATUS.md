# 功能实现状态总览

> 最后更新：2026-04-28

## 🏗️ 后端架构状态

### ✅ 100% 完成

#### 核心追踪模块
- **窗口标题提取 (watcher)**
  - 浏览器标题清理（Chrome, Safari, Edge, Firefox）
  - IDE 标题清理（VSCode, JetBrains 系列）
  - 通用应用名称提取
  - 3 个单元测试通过

- **Heartbeat 事件合并 (transform/heartbeat)**
  - 相同活动 pulsetime 内自动合并
  - 可配置 pulsetime 时长（默认 60 秒）
  - HeartbeatManager 状态管理
  - 4 个单元测试通过
  - 预计减少 70-90% 数据库写入

#### 事件驱动架构
- **统一事件总线 (event_bus)**
  - Publish/Subscribe 模式
  - 按事件类型订阅
  - 取消订阅机制
  - 事件历史记录（最多 1000 条）
  - 5 个单元测试通过
  - Tauri 命令：发布测试事件、获取事件历史、获取统计

- **TraceEvent 类型系统**
  - 18 种事件类型全覆盖：
    - 时间信号类：HourlyTick, DailySummaryTick, WeeklySummaryTick
    - 专注会话类：FocusSessionStarted, FocusSessionEnded, FocusSessionInterrupted
    - 任务操作类：TaskAdded, TaskCompleted, TaskUpdated, TaskSnoozed
    - 用户状态类：UserIdleDetected, UserReturned, AppLaunched
    - 建议反馈类：SuggestionAccepted, SuggestionRejected, SuggestionIgnored
    - 活动追踪类：ActivityRecorded, ActivityCategoryChanged, DistractionDetected

#### 隐形 Agent 规则引擎
- **RuleEngine 核心**
  - 规则注册机制
  - 事件处理管道
  - 置信度阈值判断
  - 冷却时间控制
  - 反馈记录（为强化学习做准备）

- **4 个内置规则**
  - LongFocusBreakRule: 长时间专注提醒休息（2小时阈值）
  - DistractionPatternRule: 分心模式检测（频繁应用切换）
  - TaskEstimateRule: 任务耗时智能预估
  - DailyReviewRule: 每日复盘提醒（晚 8 点触发）

#### 基础功能模块
- **Pomodoro 番茄计时器**
  - 工作/短休息/长休息 循环
  - Tauri 命令完整实现
  - 配置持久化

- **Idle Detection 空闲检测**
  - 自动暂停/恢复追踪
  - 可配置空闲阈值

- **DNS Block 网站屏蔽**
  - 专注模式下屏蔽分心网站

- **Feature Flags 功能开关**
  - 模块化功能控制

---

### ⚠️ 部分完成（需要集成）

#### 事件总线集成
- ✅ 后端核心实现完成
- ✅ 规则引擎订阅连接完成
- ⏳ 前端事件监听待实现（监听 new_suggestion 事件）
- ⏳ 各模块事件发布待接入：
  - Pomodoro 发布 FocusSession 事件
  - 任务管理发布 TaskAdded/TaskCompleted 事件
  - 空闲检测发布 UserIdleDetected/UserReturned 事件
  - 活动追踪发布 ActivityRecorded 事件

#### 规则引擎前端展示
- ✅ 后端规则处理完成
- ✅ 建议生成完成
- ✅ 事件发射机制完成
- ⏳ 前端建议展示 UI 待实现
- ⏳ 用户反馈（接受/拒绝/忽略）闭环待实现

---

## 🎨 前端页面状态

### ✅ 已实现页面框架

| 页面 | 组件路径 | 状态 | 说明 |
|------|----------|------|------|
| Dashboard | `src/pages/Dashboard.tsx` | ✅ 框架完成 | 今日概览、快捷操作、建议区域占位 |
| Timeline | `src/pages/Timeline.tsx` | ✅ 框架完成 | 时间线可视化、活动列表、编辑删除 |
| Planner | `src/pages/Planner.tsx` | ✅ 框架完成 | 任务列表、子任务、拖拽排序、日期选择 |
| Task | `src/pages/Task.tsx` | ✅ 框架完成 | 任务详情页 |
| Focus Mode | `src/pages/FocusMode.tsx` | ✅ 框架完成 | 计时器、剩余时间、控制按钮 |
| Analytics | `src/pages/Analytics.tsx` | ✅ 框架完成 | 分类饼图、趋势分析 |
| Statistics | `src/pages/Statistics.tsx` | ✅ 框架完成 | 历史统计数据 |
| Habits | `src/pages/Habits.tsx` | ✅ 框架完成 | 习惯追踪页面 |
| Virtual Pet | `src/pages/VirtualPet.tsx` | ✅ 框架完成 | 虚拟宠物激励 |
| Settings | `src/pages/Settings.tsx` | ✅ 框架完成 | 设置项完整 |
| Team | `src/pages/Team.tsx` | ✅ 框架完成 | 团队功能占位 |

### ⚠️ 需要优化/完善的页面

#### Dashboard 仪表盘
- **问题**：目前只有基础结构，数据展示不够丰富
- **可以优化**：
  - 「开始专注」大按钮（5分钟启动模式入口）
  - 「继续上次的任务」快捷入口
  - 今日专注热力图预览
  - 智能建议卡片区域
  - 启动 streak 统计（连续第几天在上午 10 点前开始工作）

#### Focus Mode 专注模式
- **问题**：只有标准番茄 25 分钟
- **可以优化**：
  - 增加「先做 5 分钟」模式
  - 「无时间限制」专注模式（用户自己决定什么时候停）
  - 启动时的心理暗示文案（"深呼吸，我们开始吧"）
  - 专注过程中的呼吸动画/冥想引导

#### Tasks 任务管理
- **问题**：创建任务门槛高，需要填很多信息
- **可以优化**：
  - 「快速添加」模式：只需要输入标题就行
  - 智能推荐下一个任务
  - 「最简单的事」按钮：自动选一个 10 分钟能做完的小事
  - 任务估算建议（基于历史数据）

#### Timeline 时间线
- **问题**：只是记录，没有洞察
- **可以优化**：
  - 自动识别「心流时间段」并高亮
  - 标记分心时段
  - 每天的「专注曲线」可视化

---

## 🧠 AI 智能引擎状态

### 💡 已有的理论基础（文档中）
- 完整的 SMART_ENGINE_ARCHITECTURE 设计
- 隐形 Agent 哲学：不聊天，只行动
- 4 层架构：Data → Insight → Rules → Actions
- 启动困难用户研究

### 🔧 已实现的技术基础
- 事件总线 ✅
- 规则引擎 ✅
- 4 个基础规则 ✅
- 建议生成机制 ✅

### 📋 待设计/实现

#### 1. 启动困难解决方案
- **5分钟启动模式**：一键开始，无设置门槛
- **「继续上次」按钮**：不用选择，直接继续
- **最小任务推荐**：推一个 10 分钟以内的最简单任务
- **无目标专注**：不用选任务，先开始再说

#### 2. 正反馈系统
- 启动 streak 统计
- 每日/每周「进步卡片」
- 小成就解锁系统
- 时间投资回报可视化

#### 3. 分心智能干预
- 识别频繁切换应用模式
- 非打扰式提醒（不是弹窗，是状态栏的微妙变化）
- 「拉回来」策略：建议休息 1 分钟，或换个简单的任务

#### 4. 习惯养成引擎
- 识别用户的工作模式
- 温和的 nudging（不是提醒，是建议）
- 渐进式习惯建立

---

## 🎯 最近优先级排序

### P0 - 本周可以做的
1. ✅ **事件总线完整集成**（刚做完）
2. ⏳ **前端建议展示组件** - 让规则引擎的建议能被用户看到
3. ⏳ **「5分钟启动模式」原型** - 第一个智能特性落地

### P1 - 2周内
1. 正反馈 MVP（启动 streak、今日成就卡片）
2. 分心检测 MVP（频繁切换检测 + 状态栏提醒）
3. 任务快速添加优化

### P2 - 1个月内
1. 完整的习惯养成引擎
2. 深度时间洞察报告
3. 个性化规则学习

---

## 📝 待讨论的问题清单

### 产品方向
1. 「启动困难」的解决方案应该做到多深？是一个功能按钮，还是一整套体验？
2. 正反馈系统怎么做才不会让人觉得「幼稚」或「游戏化过度」？
3. 隐形 Agent 的「隐形」边界在哪里？什么时候应该主动提醒，什么时候不该？

### UI/UX 细节
1. 建议出现在哪里最合适？弹窗？侧边栏？状态栏？
2. 5分钟启动模式结束时怎么反馈？是打断还是温柔引导？
3. 如何展示「你已经连续 3 天在上午 10 点前开始工作了」这种数据，才不会让人觉得被监控？

### 技术架构
1. 规则引擎需不需要机器学习？还是先纯规则跑一段时间收集数据再说？
2. 个性化配置的粒度应该多细？
