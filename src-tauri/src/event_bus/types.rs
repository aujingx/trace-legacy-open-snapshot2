//! 事件总线 - 事件类型定义
//! 所有系统内事件都在这里统一定义，确保类型安全

use chrono::{DateTime, Local, Utc};
use serde::{Serialize, Deserialize};
use uuid::Uuid;

/// 事件唯一 ID
pub type EventId = String;

/// 生成新的事件 ID
pub fn new_event_id() -> EventId {
    Uuid::new_v4().to_string()
}

/// 所有事件类型的枚举
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "payload")]
pub enum TraceEvent {
    // ============= 时间信号类 =============
    /// 每小时整点触发
    HourlyTick { hour: u32 },

    /// 每日总结信号（默认 20:00）
    DailySummaryTick,

    /// 每周总结信号（周日 21:00）
    WeeklySummaryTick,


    // ============= 专注会话类 =============
    /// 开始专注
    FocusSessionStarted {
        duration_seconds: u32,
        session_type: String, // "work" | "short_break" | "long_break"
    },

    /// 结束专注
    FocusSessionEnded {
        duration_seconds: u32,
        completed: bool,
        session_type: String,
    },

    /// 专注被打断
    FocusSessionInterrupted {
        reason: String,
        elapsed_seconds: u32,
    },


    // ============= 任务操作类 =============
    /// 用户添加了新任务
    TaskAdded {
        task_id: String,
        title: String,
        estimated_minutes: u32,
        priority: Option<u8>,
    },

    /// 任务被标记完成
    TaskCompleted {
        task_id: String,
        title: String,
        actual_minutes: f64,
        estimated_minutes: u32,
    },

    /// 任务被修改
    TaskUpdated {
        task_id: String,
        changed_fields: Vec<String>,
    },

    /// 任务被推迟
    TaskSnoozed {
        task_id: String,
        times: u32,
    },


    // ============= 用户行为类 =============
    /// 用户离开电脑（AFK）
    UserIdleDetected {
        idle_seconds: u32,
    },

    /// 用户回到电脑
    UserReturned {
        away_seconds: u32,
    },

    /// 检测到分心模式（频繁切换应用）
    DistractionDetected {
        app_switches: u32,
        duration_seconds: u32,
    },

    /// 用户打开了 Trace 应用
    AppLaunched,


    // ============= 建议反馈类 =============
    /// 用户接受了建议
    SuggestionAccepted {
        suggestion_id: String,
        rule_id: Option<String>,
    },

    /// 用户拒绝了建议
    SuggestionRejected {
        suggestion_id: String,
        rule_id: Option<String>,
    },

    /// 用户忽略了建议（展示后 5 分钟无操作）
    SuggestionIgnored {
        suggestion_id: String,
        rule_id: Option<String>,
    },


    // ============= 活动追踪类 =============
    /// 新活动被记录
    ActivityRecorded {
        activity_id: String,
        app_name: String,
        window_title: Option<String>,
        duration_minutes: f64,
        category: Option<String>,
    },

    /// 活动被手动修改分类
    ActivityCategoryChanged {
        activity_id: String,
        old_category: Option<String>,
        new_category: String,
    },
}

impl TraceEvent {
    /// 获取事件的可读名称
    pub fn name(&self) -> &'static str {
        match self {
            TraceEvent::HourlyTick { .. } => "HourlyTick",
            TraceEvent::DailySummaryTick => "DailySummaryTick",
            TraceEvent::WeeklySummaryTick => "WeeklySummaryTick",
            TraceEvent::FocusSessionStarted { .. } => "FocusSessionStarted",
            TraceEvent::FocusSessionEnded { .. } => "FocusSessionEnded",
            TraceEvent::FocusSessionInterrupted { .. } => "FocusSessionInterrupted",
            TraceEvent::TaskAdded { .. } => "TaskAdded",
            TraceEvent::TaskCompleted { .. } => "TaskCompleted",
            TraceEvent::TaskUpdated { .. } => "TaskUpdated",
            TraceEvent::TaskSnoozed { .. } => "TaskSnoozed",
            TraceEvent::UserIdleDetected { .. } => "UserIdleDetected",
            TraceEvent::UserReturned { .. } => "UserReturned",
            TraceEvent::DistractionDetected { .. } => "DistractionDetected",
            TraceEvent::AppLaunched => "AppLaunched",
            TraceEvent::SuggestionAccepted { .. } => "SuggestionAccepted",
            TraceEvent::SuggestionRejected { .. } => "SuggestionRejected",
            TraceEvent::SuggestionIgnored { .. } => "SuggestionIgnored",
            TraceEvent::ActivityRecorded { .. } => "ActivityRecorded",
            TraceEvent::ActivityCategoryChanged { .. } => "ActivityCategoryChanged",
        }
    }

    /// 判断这个事件是否应该被记录到历史日志
    pub fn should_log(&self) -> bool {
        match self {
            // 高频事件不记录，避免日志爆炸
            TraceEvent::HourlyTick { .. } => false,
            // 其他都记录
            _ => true,
        }
    }
}

/// 包装后的事件，附加元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventEnvelope {
    /// 事件唯一 ID
    pub id: EventId,
    /// 事件发生时间
    pub timestamp: DateTime<Local>,
    /// UTC 时间戳（用于跨时区）
    pub timestamp_utc: DateTime<Utc>,
    /// 事件内容
    pub event: TraceEvent,
}

impl EventEnvelope {
    /// 包装一个事件为信封
    pub fn wrap(event: TraceEvent) -> Self {
        Self {
            id: new_event_id(),
            timestamp: Local::now(),
            timestamp_utc: Utc::now(),
            event,
        }
    }
}
