//! 规则引擎核心类型定义

use chrono::{DateTime, Local};
use serde::{Serialize, Deserialize};
use std::fmt;
// 使用统一事件总线的事件类型
pub use crate::event_bus::TraceEvent;

/// 建议的类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SuggestionType {
    /// 建议休息
    TakeBreak,
    /// 建议开始专注
    StartFocus,
    /// 任务耗时预估建议
    EstimateTask,
    /// 提醒减少分心
    ReduceDistraction,
    /// 工作效率建议
    EfficiencyTip,
    /// 每日复盘提醒
    DailyReview,
}

impl fmt::Display for SuggestionType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SuggestionType::TakeBreak => write!(f, "休息建议"),
            SuggestionType::StartFocus => write!(f, "专注建议"),
            SuggestionType::EstimateTask => write!(f, "耗时预估"),
            SuggestionType::ReduceDistraction => write!(f, "减少分心"),
            SuggestionType::EfficiencyTip => write!(f, "效率建议"),
            SuggestionType::DailyReview => write!(f, "每日复盘"),
        }
    }
}

/// 系统产生的建议
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Suggestion {
    /// 建议唯一 ID
    pub id: String,
    /// 产生这个建议的规则 ID
    pub rule_id: String,
    /// 建议类型
    pub suggestion_type: SuggestionType,
    /// 建议的标题（简短）
    pub title: String,
    /// 建议的详细描述
    pub description: String,
    /// 置信度 (0-1)
    pub confidence: f32,
    /// 建议的优先级（0-10，越高越重要）
    pub priority: u8,
    /// 建议的行动文案（按钮文字）
    pub action_text: Option<String>,
    /// 建议产生的时间
    pub timestamp: DateTime<Local>,
}

impl Suggestion {
    /// 创建一个新的建议
    pub fn new(
        suggestion_type: SuggestionType,
        title: impl Into<String>,
        description: impl Into<String>,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            rule_id: String::new(),
            suggestion_type,
            title: title.into(),
            description: description.into(),
            confidence: 0.5,
            priority: 5,
            action_text: None,
            timestamp: Local::now(),
        }
    }

    /// 设置置信度
    pub fn confidence(mut self, confidence: f32) -> Self {
        self.confidence = confidence.clamp(0.0, 1.0);
        self
    }

    /// 设置优先级
    pub fn priority(mut self, priority: u8) -> Self {
        self.priority = priority.clamp(0, 10);
        self
    }

    /// 设置行动文案
    pub fn action_text(mut self, text: impl Into<String>) -> Self {
        self.action_text = Some(text.into());
        self
    }
}

/// 用户对建议的反馈类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FeedbackType {
    /// 用户接受了建议并执行
    Accepted,
    /// 用户明确拒绝
    Rejected,
    /// 用户看到了但没有任何操作（隐式拒绝）
    Ignored,
    /// 用户延后了建议
    Snoozed,
}

/// 规则反馈记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleFeedback {
    pub suggestion_id: String,
    pub feedback: FeedbackType,
    pub timestamp: DateTime<Local>,
}

/// 规则 trait，所有规则都需要实现这个
pub trait Rule: Send + Sync {
    /// 规则的唯一标识
    fn id(&self) -> String;

    /// 规则的人类可读名称
    fn name(&self) -> String;

    /// 规则描述
    fn description(&self) -> String;

    /// 检查这个事件是否应该触发规则
    fn should_trigger(&self, event: &TraceEvent) -> bool;

    /// 生成建议
    fn generate_suggestion(&self, event: &TraceEvent) -> Suggestion;

    /// 当前规则的置信度（0-1）
    /// 随着用户反馈，这个值会动态调整
    fn confidence(&self) -> f32 {
        0.5 // 默认中等置信度
    }

    /// 触发阈值，只有置信度高于这个值才会实际触发
    fn trigger_threshold(&self) -> f32 {
        0.3 // 默认比较宽松
    }

    /// 冷却时间（秒），防止频繁触发
    fn cooldown_seconds(&self) -> u32 {
        3600 // 默认 1 小时
    }
}

// 让 Box<dyn Rule> 也实现 Rule
impl Rule for Box<dyn Rule> {
    fn id(&self) -> String {
        (**self).id()
    }

    fn name(&self) -> String {
        (**self).name()
    }

    fn description(&self) -> String {
        (**self).description()
    }

    fn should_trigger(&self, event: &TraceEvent) -> bool {
        (**self).should_trigger(event)
    }

    fn generate_suggestion(&self, event: &TraceEvent) -> Suggestion {
        (**self).generate_suggestion(event)
    }

    fn confidence(&self) -> f32 {
        (**self).confidence()
    }

    fn trigger_threshold(&self) -> f32 {
        (**self).trigger_threshold()
    }

    fn cooldown_seconds(&self) -> u32 {
        (**self).cooldown_seconds()
    }
}
