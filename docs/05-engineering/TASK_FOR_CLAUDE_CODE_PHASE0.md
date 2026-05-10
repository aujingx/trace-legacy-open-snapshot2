# Claude Code 执行清单 - Phase 0 稳定化

> 最后更新：2026-05-05
>
> 用途：这是发给 Claude Code 的阶段性 `todo` 清单。
> 要求：Claude Code 只能按条执行和回报，不能改写产品方向，不能自己重排优先级。

---

## 1. 固定角色

- `你` = Jing
- `主控 agent` = Codex
- `执行 agent` = Claude Code

Claude Code 只负责：

- 读取指定文档
- 完成当前条目
- 回报实际修改和实际验证

Claude Code 不负责：

- 重定义产品
- 重写总览规则
- 跳过未完成条目自行做下一项

---

## 2. 开始前必须阅读

按下面顺序阅读：

1. `docs/00-overview/RECOVERY_TRUTH_TABLE.md`
2. `docs/00-overview/IMPLEMENTATION_STATUS.md`
3. `docs/05-engineering/DEVELOPMENT_GUARDRAILS.md`
4. `docs/05-engineering/AGENT_EXECUTION_WORKFLOW.md`

如果任务直接涉及 Timeline，再补读：

5. `docs/02-features/TIMELINE.md`

---

## 3. 已完成条目

这些条目已经完成，后续任务默认建立在这些结果之上，除非发现明确回归。

- [x] 验证桌面端真实冒烟流程，不再只看 web 模式
- [x] 修复桌面应用启动即退出问题
- [x] 统一活动 JSON 与 SQLite 的数据目录根路径
- [x] 修复桌面端默认自动追踪启动链路
- [x] 修复 `Dashboard / Analytics` 的基本真实数据读取
- [x] 恢复 `CSP` 配置，不保留 `csp: null`
- [x] 恢复 `macOS entitlements` 配置
- [x] 在 `Timeline` 中开始显示自动追踪活动（背景层）
- [x] 禁用 `Morning Ritual / Daily Review` 的自动硬弹 modal 触发
- [x] **P1**: 活动可点击查看详情 + 手动关联任务（持久化存储）
- [x] **P1**: time_block / task relationship enhancement（时间块任务关联视觉标识）
- [x] **P2**: activity / time_block time overlap visual hints（活动与时间块重叠视觉提示）

---

## 4. 当前正式页面真相

当前正式页面只认这 6 个：

- `Dashboard`
- `Timeline`
- `Tasks`
- `Analytics`
- `Settings`
- `Focus`

补充：

- `Statistics` 不属于当前正式页面
- `Timeline` 是核心页面，不是长期降级页
- onboarding 最多只保留首次教学
- `Morning Ritual / Daily Review / 明日安排` 不属于 onboarding

---

## 5. 当前未完成条目

下面这些是接下来 1-2 天仍需继续完成的 `P0 / P1 / P2` 事项。

### A. P0 主链路收口：活动数据继续以 JSON 作为唯一真相

当前策略已经确定：

- `activities` 暂时继续以 JSON 作为唯一真相
- 当前不做 `JSON -> SQLite` 迁移
- 目标不是架构重构，而是先让产品稳定跑起来、减少“页面各说各话”的混乱

#### P0 已完成

- [x] 自动追踪活动写入 JSON 正常工作
- [x] `Dashboard / Timeline / Analytics` 基本能读取活动数据
- [x] 活动统计读取入口开始收口到统一文件读取函数

#### P0 待完成

- [ ] `Dashboard / Timeline / Analytics` 三页面数据一致性真实验证
  - 同一天活动在这三个页面展示的总时长差值不应出现明显分裂
  - 分类与活动列表来源必须能解释清楚
- [ ] 确认活动相关统计不再继续新增“绕开统一入口”的文件读取逻辑
- [ ] 确认导出、周统计、月统计与单日活动读取口径一致
- [ ] 明确当前阶段“活动真相源 = JSON”这件事在执行任务时不再被误改

#### P0 检查点（必须先停下回报）

出现以下任一情况，Claude Code 必须停止继续开发并先回报：

- [ ] 发现 `Dashboard / Timeline / Analytics` 同一天总时长明显不一致
- [ ] 发现某个活动统计接口仍在自己拼文件读取和反序列化逻辑
- [ ] 发现为了修统计问题，需要顺手引入 SQLite 活动读写
- [ ] 发现活动 JSON 数据本身与界面展示结果对不上

### B. P1 核心页面可用性验证

这一组不是架构迁移，而是确认主页面真的形成可用闭环。

#### P1 已完成

- [x] `Timeline` 中三类对象职责已澄清：
  - `activities` = 真实自动追踪活动
  - `time_blocks` = 可编辑、可拖拽的计划时间块
  - `tasks` = 任务源 / 待办对象
- [x] `Timeline` 背景活动显示
- [x] 活动点击详情
- [x] `activity -> task` 手动关联并持久化
- [x] `time_block -> task` 视觉标识增强
- [x] `activity / time_block` 重叠视觉提示

#### P1 待完成

- [ ] `Analytics` 与 `Dashboard / Timeline` 的真实数据口径复核
- [ ] `Focus` 页面是否真正形成闭环：
  - 开始专注后，是否有真实可解释的数据结果
  - 用户结束后，是否能在主链路里理解“这次专注发生了什么”
- [ ] `Tasks` 页面与当前活动/时间块关系是否已经“够用”
  - 不要求完美统一模型
  - 只要求不会明显误导用户

#### P1 候选动作（当前不自动执行）

- [ ] `activity / time_block / task` 联动高亮

#### P1 检查点（必须先停下回报）

出现以下任一情况，Claude Code 必须停止继续开发并先回报：

- [ ] `Focus` 的专注结果无法在主链路中找到落点
- [ ] `Analytics` 的数字与 `Timeline / Dashboard` 对不上且无法快速解释
- [ ] 为了修页面闭环，必须引入新的数据模型或新的存储路径
- [ ] 需要重做 `Timeline` UI 才能继续

### C. P2 延后项

这些不是当前主线，不进入马上执行范围。

- [ ] `SQLite` 活动迁移
- [ ] `Onboarding` 完整设计
- [ ] 通知式提醒体系
- [ ] 视觉打磨、增强动画、额外提示文案
- [ ] 高级筛选、批量编辑、复杂 AI 规则

---

## 6. 执行顺序（未来 1-2 天）

Claude Code 后续执行时，默认按下面顺序推进：

1. **P0-1**
   - 做 `Dashboard / Timeline / Analytics` 三页面数据一致性真实验证
   - 这是当前最高优先级
2. **检查点 A**
   - 如果三页面数据不一致，停止并只汇报问题，不进入下一个任务
3. **P1-1**
   - 做 `Focus` 页面闭环 review
   - 只判断“是否能被用户理解和使用”，不先改 UI
4. **检查点 B**
   - 如果 `Focus` 没有清晰数据落点，停止并只给一个最小修复方向
5. **P1-2**
   - 做 `Tasks` 与当前活动/时间块关系的可用性确认
   - 只确认是否“够用”，不做大统一模型

任何一步失败，都不允许自动跳到后一步。

---

## 7. Claude Code 下一步只做什么

下一轮只允许做：

1. `P0-1`：`Dashboard / Timeline / Analytics` 三页面数据一致性真实验证
2. 如发现问题，只定位并汇报最小问题边界
3. 不自动进入下一项实现

下一轮不做：

- 不碰启动修复
- 不碰 `SQLite` 迁移
- 不恢复任何 Guardian 自动 modal
- 不重写文档体系
- 不做推荐系统
- 不做大重构
- 不继续展开 `Timeline` 小增强

---

## 8. 允许修改范围

下一轮默认允许：

- 默认先不改代码
- 只有在 `P0-1` 真实验证发现明确问题后，才允许最小修改：
  - `src/pages/Analytics.tsx`
  - `src/pages/Timeline.tsx`
  - `src/pages/Dashboard.tsx`
  - `src/services/ipc/activityIpc.ts`
  - `src/services/dataService.ts`
  - `src-tauri/src/main.rs`

默认不允许：

- `docs/00-overview/*`
- 启动修复相关核心链路，除非发现明确回归
- 无关页面和无关功能

---

## 9. 输出格式

Claude Code 完成后必须按下面格式回复：

### 1. 本轮处理的清单项

- 明确写本轮完成了 `todo` 里的哪些条目
- 没完成的条目不要写成“部分通过”糊弄过去

### 2. 当前事实

- Timeline 中 `activities / time_blocks / tasks` 当前各自扮演什么角色
- 本轮有没有改变这个关系

### 3. 改了什么

- 文件
- 每处修改目的

### 4. 跑了哪些验证

- 实际命令
- 实际手动操作
- 实际观察结果
- 如果本轮是检查点失败：
  - 必须明确写“停止在检查点 A/B”
  - 必须明确写“未进入后续任务”
- 如果本轮涉及 UI/交互功能：
  - 必须逐步写清楚用户点击了什么
  - 必须逐步写清楚屏幕上实际出现了什么
  - 不能写“理论上可行”“待用户手动验证”“代码链路完整”替代结果

### 5. 当前结论

- 通过 / 不通过

### 6. 剩余未完成条目

- 直接引用本文件中的未完成项

---

## 10. 通过标准

只有同时满足下面 4 条，才算本轮通过：

1. 没有扩 scope
2. 没有把当前 `JSON` 真相源偷偷改回迁移议题
3. 对当前任务的边界给出了清晰、可验证的结论
4. 用真实桌面运行做了验证，而不是只读代码

补充：

- 如果任务目标包含“可点击”“可关联”“可持久化”“可见反馈”等交互结果，必须完成一次真实手动用户路径验证，否则只能记为“实现完成，验收未完成”。
- 如果任务命中检查点，及时停止并回报，视为正确执行，不算失败。
