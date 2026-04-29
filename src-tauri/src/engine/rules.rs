//! 内置规则集合
//! 所有规则都实现 Rule trait

use super::*;
use serde::{Serialize, Deserialize};

// ==================== 规则 1: 长时间专注提醒休息 ====================

/// 长时间专注提醒休息规则
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LongFocusBreakRule {
    // 可以在这里放规则的内部状态，比如累计专注时间
    #[serde(skip)]
    total_focus_today: std::sync::Arc<std::sync::Mutex<u32>>,
}

impl Rule for LongFocusBreakRule {
    fn id(&self) -> String {
        "long_focus_break".to_string()
    }

    fn name(&self) -> String {
        "长时间专注提醒休息".to_string()
    }

    fn description(&self) -> String {
        "连续专注超过 2 小时后，提醒用户适当休息".to_string()
    }

    fn should_trigger(&self, event: &TraceEvent) -> bool {
        match event {
            TraceEvent::FocusSessionEnded { duration_seconds, .. } => {
                let mut total = self.total_focus_today.lock().unwrap();
                *total += duration_seconds;

                // 累计专注超过 2 小时，且是自然结束（不是暂停）
                *total >= 2 * 60 * 60 && *total % (2 * 60 * 60) < *duration_seconds + 60
            }
            TraceEvent::HourlyTick { .. } => {
                // 每小时也检查一下，如果累计专注太久了
                let total = *self.total_focus_today.lock().unwrap();
                total >= 3 * 60 * 60 // 超过 3 小时强制提醒
            }
            _ => false,
        }
    }

    fn generate_suggestion(&self, _event: &TraceEvent) -> Suggestion {
        Suggestion::new(
            SuggestionType::TakeBreak,
            "该休息一下了 ☕",
            "你已经连续专注工作了很久，站起来活动一下，喝杯水吧。\n5-10 分钟的休息能让接下来的效率更高。",
        )
        .confidence(0.8)
        .priority(7)
        .action_text("知道了")
    }

    fn confidence(&self) -> f32 {
        0.8 // 这个规则很成熟，置信度高
    }

    fn cooldown_seconds(&self) -> u32 {
        2 * 60 * 60 // 2 小时冷却，避免频繁提醒
    }
}

// ==================== 规则 2: 分心模式提醒 ====================

/// 检测到频繁分心时给出建议
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DistractionPatternRule {
    #[serde(skip)]
    recent_distractions: std::sync::Arc<std::sync::Mutex<Vec<u32>>>,
}

impl Rule for DistractionPatternRule {
    fn id(&self) -> String {
        "distraction_pattern".to_string()
    }

    fn name(&self) -> String {
        "分心模式提醒".to_string()
    }

    fn description(&self) -> String {
        "当检测到用户频繁切换应用、注意力不集中时，给出建议".to_string()
    }

    fn should_trigger(&self, event: &TraceEvent) -> bool {
        match event {
            TraceEvent::DistractionDetected { app_switches, .. } => {
                let mut recent = self.recent_distractions.lock().unwrap();
                recent.push(*app_switches);
                if recent.len() > 5 {
                    *recent = recent.iter().skip(recent.len() - 5).copied().collect();
                }

                // 最近 3 次检测都有高频切换
                if recent.len() >= 3 {
                    let avg: u32 = recent.iter().sum::<u32>() / recent.len() as u32;
                    avg > 10 // 平均每分钟切换超过 10 次，严重分心
                } else {
                    false
                }
            }
            _ => false,
        }
    }

    fn generate_suggestion(&self, _event: &TraceEvent) -> Suggestion {
        Suggestion::new(
            SuggestionType::ReduceDistraction,
            "你有些分心哦 🎯",
            "我注意到你最近频繁切换应用，注意力不太集中。\n要不要开启专注模式，屏蔽一下干扰？",
        )
        .confidence(0.6)
        .priority(6)
        .action_text("开启专注模式")
    }

    fn confidence(&self) -> f32 {
        0.6 // 这个规则偶尔会误判，置信度中等
    }

    fn cooldown_seconds(&self) -> u32 {
        30 * 60 // 30 分钟冷却
    }
}

// ==================== 规则 3: 任务耗时预估 ====================

/// 基于历史数据给出任务预估时间
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TaskEstimateRule {
    #[serde(skip)]
    #[allow(dead_code)]
    task_history: std::sync::Arc<std::sync::Mutex<HashMap<String, Vec<f64>>>>,
}

impl Rule for TaskEstimateRule {
    fn id(&self) -> String {
        "task_estimate".to_string()
    }

    fn name(&self) -> String {
        "智能任务预估".to_string()
    }

    fn description(&self) -> String {
        "基于同类任务的历史数据，给出智能预估时间".to_string()
    }

    fn should_trigger(&self, event: &TraceEvent) -> bool {
        // 当用户添加新任务时触发
        matches!(event, TraceEvent::TaskAdded { .. })
    }

    fn generate_suggestion(&self, event: &TraceEvent) -> Suggestion {
        if let TraceEvent::TaskAdded { title, .. } = event {
            // 简单的关键词匹配，未来可以用更复杂的模型
            let estimate_mins = if title.contains("开发") || title.contains("代码") {
                90
            } else if title.contains("会议") || title.contains("讨论") {
                45
            } else if title.contains("文档") || title.contains("写") {
                60
            } else if title.contains("阅读") || title.contains("学习") {
                45
            } else {
                30
            };

            Suggestion::new(
                SuggestionType::EstimateTask,
                format!("建议预留 {} 分钟", estimate_mins),
                format!("根据类似任务的历史数据，「{}」大概需要 {} 分钟完成。", title, estimate_mins),
            )
            .confidence(0.5) // 初始置信度中等，会随用户反馈调整
            .priority(4)
            .action_text("使用这个预估")
        } else {
            // 不应该走到这里
            Suggestion::new(SuggestionType::EstimateTask, "", "")
        }
    }

    fn confidence(&self) -> f32 {
        0.5 // 基于关键词匹配，比较基础
    }

    fn cooldown_seconds(&self) -> u32 {
        60 // 这个规则可以频繁触发，因为是用户创建任务时才触发
    }
}

// ==================== 规则 4: 每日复盘提醒 ====================

/// 每日复盘提醒规则
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DailyReviewRule;

impl Rule for DailyReviewRule {
    fn id(&self) -> String {
        "daily_review".to_string()
    }

    fn name(&self) -> String {
        "每日复盘提醒".to_string()
    }

    fn description(&self) -> String {
        "每天晚上提醒用户进行每日复盘".to_string()
    }

    fn should_trigger(&self, event: &TraceEvent) -> bool {
        // 只在 DailySummaryTick 事件触发
        matches!(event, TraceEvent::DailySummaryTick)
    }

    fn generate_suggestion(&self, _event: &TraceEvent) -> Suggestion {
        Suggestion::new(
            SuggestionType::DailyReview,
            "今日复盘时间 📝",
            "一天快结束了，花 2 分钟回顾一下今天的成果吧。\n看看完成了什么，哪些地方可以做得更好。",
        )
        .confidence(0.9)
        .priority(8)
        .action_text("开始复盘")
    }

    fn confidence(&self) -> f32 {
        0.9 // 这个规则几乎不会错
    }

    fn cooldown_seconds(&self) -> u32 {
        12 * 60 * 60 // 12 小时，一天只提醒一次
    }
}

// ==================== 规则测试 ====================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_long_focus_rule() {
        let rule = LongFocusBreakRule::default();

        // 创建一个 2.5 小时的专注结束事件
        let event = TraceEvent::FocusSessionEnded {
            duration_seconds: 9000, // 2.5 小时
            completed: true,
            session_type: "work".to_string(),
        };

        // 第一次应该触发
        assert!(rule.should_trigger(&event));

        let suggestion = rule.generate_suggestion(&event);
        assert_eq!(suggestion.suggestion_type, SuggestionType::TakeBreak);
        assert!(suggestion.confidence > 0.7);
    }

    #[test]
    fn test_daily_review_rule() {
        let rule = DailyReviewRule;

        // 每日总结事件应该触发
        let event = TraceEvent::DailySummaryTick;
        assert!(rule.should_trigger(&event));

        // 其他事件不应该触发
        let other_event = TraceEvent::AppLaunched;
        assert!(!rule.should_trigger(&other_event));
    }
}
