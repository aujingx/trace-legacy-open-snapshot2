//! 「隐形 Agent」规则引擎
//! 核心设计：事件驱动 → 规则匹配 → 产生建议 → 用户反馈 → 权重学习
//!
//! 所有智能都在这里发生，但用户永远看不见这个模块。

pub mod rules;
pub mod types;
pub mod commands;

pub use rules::*;
pub use types::*;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use chrono::{DateTime, Local};
use serde::Serialize;

/// 规则引擎核心
#[derive(Clone)]
pub struct RuleEngine {
    /// 所有注册的规则
    rules: Arc<Mutex<Vec<Box<dyn Rule>>>>,
    /// 规则执行历史（用于避免重复提醒）
    execution_history: Arc<Mutex<HashMap<String, DateTime<Local>>>>,
    /// 用户反馈历史（用于权重学习）
    feedback_history: Arc<Mutex<Vec<RuleFeedback>>>,
}

impl Default for RuleEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl RuleEngine {
    /// 创建新的规则引擎
    pub fn new() -> Self {
        Self {
            rules: Arc::new(Mutex::new(Vec::new())),
            execution_history: Arc::new(Mutex::new(HashMap::new())),
            feedback_history: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// 注册一个规则
    pub fn register_rule(&self, rule: Box<dyn Rule>) {
        let mut rules = self.rules.lock().unwrap();
        rules.push(rule);
    }

    /// 注册所有内置规则
    pub fn register_builtin_rules(&self) {
        // v1.1 基础规则集
        self.register_rule(Box::new(rules::LongFocusBreakRule::default()));
        self.register_rule(Box::new(rules::DistractionPatternRule::default()));
        self.register_rule(Box::new(rules::TaskEstimateRule::default()));
    }

    /// 处理一个事件，返回应该触发的建议列表
    pub fn process_event(&self, event: &TraceEvent) -> Vec<Suggestion> {
        let rules = self.rules.lock().unwrap();
        let mut history = self.execution_history.lock().unwrap();
        let now = Local::now();
        let mut suggestions = Vec::new();

        for rule in rules.iter() {
            let rule_id = rule.id();

            // 1. 检查冷却时间
            if let Some(last_exec) = history.get(&rule_id) {
                let cooldown = rule.cooldown_seconds();
                if (now - *last_exec).num_seconds() < cooldown as i64 {
                    continue;
                }
            }

            // 2. 检查规则是否应该触发
            if rule.should_trigger(event) {
                // 3. 检查置信度阈值
                let confidence = rule.confidence();
                if confidence >= rule.trigger_threshold() {
                    let mut suggestion = rule.generate_suggestion(event);
                    suggestion.confidence = confidence;
                    suggestion.rule_id = rule_id.clone();

                    suggestions.push(suggestion);

                    // 记录执行时间
                    history.insert(rule_id, now);
                }
            }
        }

        suggestions
    }

    /// 记录用户对建议的反馈（用于未来的强化学习）
    pub fn record_feedback(&self, suggestion_id: String, feedback: FeedbackType) {
        let mut history = self.feedback_history.lock().unwrap();
        history.push(RuleFeedback {
            suggestion_id,
            feedback,
            timestamp: Local::now(),
        });

        // 限制历史记录大小，只保留最近 1000 条
        if history.len() > 1000 {
            *history = history.iter().skip(history.len() - 1000).cloned().collect();
        }
    }

    /// 获取规则统计信息（调试用）
    pub fn get_rule_stats(&self) -> Vec<RuleStats> {
        let rules = self.rules.lock().unwrap();
        rules.iter()
            .map(|r| RuleStats {
                id: r.id(),
                name: r.name(),
                description: r.description(),
                confidence: r.confidence(),
            })
            .collect()
    }
}

/// 规则统计信息
#[derive(Debug, Clone, Serialize)]
pub struct RuleStats {
    pub id: String,
    pub name: String,
    pub description: String,
    pub confidence: f32,
}
