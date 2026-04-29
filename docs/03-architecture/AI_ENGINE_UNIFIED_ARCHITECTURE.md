# 🧠 Trace AI 引擎 - 统一架构设计

> 最后更新：2026-04-28
> 状态：设计定稿

---

## 🎯 设计原则

### 1. **统一入口，模块化实现**
- 所有 AI 功能共享同一个「用户画像数据层」
- 但每个功能模块独立开发、独立测试、独立部署
- 文档和代码分开，但底层数据互通

### 2. **事件驱动，松耦合**
- 所有模块通过 **事件总线** 通信
- 模块之间不直接调用，只监听和发布事件
- 加新功能不需要改旧代码

### 3. **渐进式智能化**
- 每个功能都从「笨」到「聪明」渐进式迭代
- 先做规则驱动，再做数据驱动，最后加机器学习
- 每个阶段的版本都是完整可用的

---

## 🏛️ 整体架构图（四层）

```
┌─────────────────────────────────────────────────────────────────┐
│                     🔌 AI 功能接入层（UI 层）                     │
│                                                                   │
│  • Dashboard 自然语言输入框                                       │
│  • Dashboard 智能建议卡片                                         │
│  • 专注模式分心提醒                                               │
│  • 任务页面自动推荐                                               │
│  • 分析页面洞察报告                                               │
│  • Toast 温和提醒                                                 │
└─────────────────────────────────┬─────────────────────────────────┘
                                  │
┌─────────────────────────────────▼─────────────────────────────────┐
│                     🤖 AI 功能模块层（原子能力）                    │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────────┐  │
│  │  NL Task    │  │  Rule       │  │  Positive Feedback        │  │
│  │  Agent      │  │  Engine     │  │  Engine 正反馈系统        │  │
│  │  自然语言任务│  │  规则引擎   │  │                           │  │
│  └─────────────┘  └─────────────┘  └───────────────────────────┘  │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────────┐  │
│  │  Now       │  │  Distraction│  │  User Pattern            │  │
│  │  Engine    │  │  Detector   │  │  Learner 用户模式学习      │  │
│  │  任务推荐   │  │  分心检测   │  │                           │  │
│  └─────────────┘  └─────────────┘  └───────────────────────────┘  │
└─────────────────────────────────┬─────────────────────────────────┘
                                  │
┌─────────────────────────────────▼─────────────────────────────────┐
│                     📊 共享数据层（Single Source of Truth）         │
│                                                                   │
│  • User Profile 用户画像                                            │
│    ├─ 平均每日专注时长                                             │
│    ├─ 效率最高的时间段                                             │
│    ├─ 预估时间偏差系数（通常低估/高估多少）                         │
│    ├─ 任务完成率历史                                               │
│    └─ 分心频率与模式                                               │
│                                                                   │
│  • Task Knowledge Base 任务知识库                                  │
│    ├─ 任务类型与平均耗时映射                                       │
│    ├─ 典型任务的难度标签                                           │
│    └─ 任务之间的依赖关系模式                                       │
│                                                                   │
│  • History Event Log 历史事件日志                                  │
│    └─ 所有历史事件的时间序列（供规则和学习用）                     │
└─────────────────────────────────┬─────────────────────────────────┘
                                  │
┌─────────────────────────────────▼─────────────────────────────────┐
│                     📡 统一事件总线 Event Bus                      │
│                                                                   │
│  TaskCreated / TaskCompleted / FocusStarted / FocusEnded          │
│  AppSwitched / UserIdle / UserReturned / DailySummaryTick         │
└───────────────────────────────────────────────────────────────────┘
```

---

## 📦 每个模块的职责边界

### 1. 📡 事件总线（已实现 ✅）

**职责**：所有模块之间的唯一通信方式

**已有的事件类型**：
- `TaskCreated` / `TaskCompleted` / `TaskUpdated`
- `FocusSessionStarted` / `FocusSessionEnded`
- `ActivityRecorded`
- `UserIdleDetected` / `UserReturned`
- `HourlyTick` / `DailySummaryTick`
- `SuggestionAccepted` / `SuggestionRejected`

**设计原则**：
- 只增不减，新功能只加新事件类型
- 所有事件都可以被任意模块监听
- 发布事件的模块不需要知道谁在监听

---

### 2. 📊 共享数据层（待实现 P0-P1 阶段）

**职责**：所有 AI 模块共享的用户画像和历史数据，避免每个模块自己存一份

#### UserProfile 用户画像
```typescript
interface UserProfile {
  // 专注习惯
  avgDailyFocusMinutes: number;      // 平均每天专注时长
  mostProductiveHours: number[];     // 效率最高的时间段（小时）
  focusBlockPreference: 'short' | 'medium' | 'long'; // 喜欢的专注块长度
  
  // 时间预估习惯
  estimationBiasFactor: number;       // 预估偏差系数（0.7 = 通常低估 30%）
  
  // 任务完成习惯
  avgTasksCompletedPerDay: number;    // 平均每天完成任务数
  procrastinationRate: number;         // 任务平均被推迟多少次
  
  // 分心模式
  avgDistractionsPerHour: number;      // 平均每小时分心次数
  mostDistractedHours: number[];       // 最容易分心的时间段
  
  // 历史数据（用于持续学习）
  dataPoints: number;                  // 已有多少天的数据
  lastUpdated: Date;
}
```

#### TaskKnowledgeBase 任务知识库
```typescript
interface TaskKnowledgeBase {
  // 关键词 → 典型预估时间
  keywordToEstimatedMinutes: Map<string, number>;
  
  // 关键词 → 难度标签
  keywordToDifficulty: Map<string, 'easy' | 'medium' | 'hard'>;
  
  // 任务类型 → 推荐时间段
  taskTypeToPreferredTime: Map<string, 'morning' | 'afternoon' | 'evening'>;
}
```

**更新机制**：
- 每天晚上 `DailySummaryTick` 事件触发时，自动重新计算用户画像
- 每次完成任务时，更新任务知识库的统计数据
- 所有 AI 模块读取同一个数据源，保证一致性

---

### 3. 🤖 AI 功能模块（按优先级排序）

#### 🎯 P0-P1 阶段要做的模块

| 模块 | 优先级 | 职责 | 依赖的共享数据 |
|------|-------|------|---------------|
| **NL Task Agent** | P0 | 自然语言创建任务 | 暂无（P0 纯提取，P1 开始用） |
| **Rule Engine** | P0 | 基于规则的实时提醒 | 历史事件日志 |
| **Positive Feedback Engine** | P1 | 正反馈、streak、成就系统 | UserProfile |
| **Now Engine** | P1 | 智能推荐下一个做什么任务 | UserProfile + TaskKnowledgeBase |

#### 🎯 P2 阶段要做的模块

| 模块 | 优先级 | 职责 | 依赖的共享数据 |
|------|-------|------|---------------|
| **Distraction Detector** | P2 | 分心模式识别与温和干预 | UserProfile + 实时事件 |
| **User Pattern Learner** | P2 | 用户模式持续学习与更新 | 所有历史数据 |

#### 🎯 P3 阶段要做的模块

| 模块 | 优先级 | 职责 | 依赖的共享数据 |
|------|-------|------|---------------|
| **Dynamic Planner** | P3 | 自动重排、过载保护、任务拆分 | 所有共享数据 |
| **Insight Generator** | P3 | 每周/每月洞察报告生成 | 所有历史数据 |

---

## 🔄 数据流动示例

### 示例 1：用户完成一个任务后的连锁反应

```
1. 用户点击「完成任务」
   ↓
2. 前端发布 TaskCompleted 事件到事件总线
   ↓
3. 各个模块自动响应：

   📊 User Pattern Learner：
   - 记录「预估时间 vs 实际时间」的偏差
   - 更新用户的 estimationBiasFactor
   
   👍 Positive Feedback Engine：
   - 检查是不是连续第 N 天完成任务
   - 如果达成 streak，发一个成就 Toast
   
   🤖 Now Engine：
   - 这个任务完成了，推荐下一个最适合现在做的任务
   - 更新 Dashboard 的推荐列表
   
   📋 Rule Engine：
   - 检查是不是今天完成的第 3 个任务
   - 如果是，触发「今天进度不错，要不要休息一下」的建议
```

**关键**：发布事件的模块（任务系统）完全不知道有这 4 个模块在监听，完全解耦。

---

### 示例 2：NL Agent 创建新任务

```
1. 用户在输入框说：「明天上午写 API 文档，大概 2 小时」
   ↓
2. NL Task Agent 提取信息，发布 TaskCreated 事件
   ↓
3. 各个模块自动响应：

   📊 Task Knowledge Base：
   - 记录「API 文档」这类任务通常预估 2 小时
   - 未来其他用户（或同一个用户）说类似的关键词时，预估更准
   
   🤖 Now Engine：
   - 把这个新任务加入推荐候选池
   - 如果优先级够高，放到 Dashboard 推荐列表第一位
   
   ⏰ Dynamic Planner（P2）：
   - 检查明天上午有没有冲突
   - 自动安排到合适的时间块
```

---

## ✅ 架构优势

1. **零耦合加新功能**：想加新的 AI 功能，只要监听事件就行，不需要改任何现有代码
2. **数据一致**：所有模块读同一份用户画像，不会出现「这个模块说我效率高，那个说我效率低」
3. **渐进式开发**：可以先做最简单的模块，共享数据层慢慢丰富，不影响前面的功能
4. **可测试性好**：每个模块可以独立写单元测试，不需要依赖其他模块
5. **可独立开关**：用户不想用某个 AI 功能，可以单独关掉，不影响其他

---

## 📋 实现顺序建议

### Phase 1（和 P0 NL Agent 同步做）
1. ✅ 事件总线（已经做完了）
2. 📝 User Profile 数据结构定义 + 简单的每日更新逻辑
3. 📝 Positive Feedback Engine 基础版（只做启动 streak）

### Phase 2（P1 阶段）
1. 把 Rule Engine 迁移到新架构（现在的规则引擎还没接事件总线）
2. Now Engine 用 User Profile 数据做推荐
3. Task Knowledge Base 基础版

### Phase 3（P2+）
1. Distraction Detector
2. User Pattern Learner 的持续学习逻辑
3. Dynamic Planner 的自动重排

---

## 🔗 相关文档

- [事件总线设计文档](./EVENT_BUS_ARCHITECTURE.md)
- [规则引擎设计文档](./SMART_ENGINE_ARCHITECTURE.md)
- [自然语言任务 Agent P0 计划](../04-ai-engine/NL_AGENT_P0_PLAN.md)
- [正反馈系统设计](../04-ai-engine/STARTUP_DIFFICULTY_SOLUTION.md)
