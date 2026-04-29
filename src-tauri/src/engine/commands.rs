//! 规则引擎的 Tauri Commands
//! 提供给前端调用的接口

use super::*;
use crate::AppState;
use tauri::{State, Emitter};

/// 获取当前待展示的建议列表
#[tauri::command]
pub async fn get_suggestions(
    _state: State<'_, AppState>,
) -> Result<Vec<Suggestion>, String> {
    // 目前这个命令只是返回空列表，实际的建议会通过事件推送
    // 未来可以实现建议队列，用户可以查看历史建议
    Ok(Vec::new())
}

/// 用户对建议做出反馈
#[tauri::command]
pub async fn submit_suggestion_feedback(
    state: State<'_, AppState>,
    suggestion_id: String,
    feedback: String,
) -> Result<(), String> {
    let feedback_type = match feedback.as_str() {
        "accepted" => FeedbackType::Accepted,
        "rejected" => FeedbackType::Rejected,
        "snoozed" => FeedbackType::Snoozed,
        _ => FeedbackType::Ignored,
    };

    state.rule_engine.record_feedback(suggestion_id, feedback_type);
    Ok(())
}

/// 触发一个测试事件（开发调试用）
#[tauri::command]
pub async fn trigger_test_event(
    state: State<'_, AppState>,
    event_type: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // 注意：这里直接创建事件枚举，不包装成 EventEnvelope
    // 因为 process_event 只需要事件内容
    let trace_event = match event_type.as_str() {
        "long_focus" => TraceEvent::FocusSessionEnded {
            duration_seconds: 9000, // 2.5 小时
            completed: true,
            session_type: "work".to_string(),
        },
        "daily_review" => TraceEvent::DailySummaryTick,
        "distraction" => TraceEvent::DistractionDetected {
            app_switches: 15,
            duration_seconds: 300,
        },
        _ => return Err(format!("Unknown event type: {}", event_type)),
    };

    // 处理事件，获取建议
    let suggestions = state.rule_engine.process_event(&trace_event);

    // 向前端推送建议事件
    if !suggestions.is_empty() {
        if let Err(e) = app_handle.emit("new_suggestion", &suggestions) {
            eprintln!("Failed to emit suggestion event: {}", e);
        }
    }

    Ok(())
}

/// 获取所有已注册规则的统计信息（调试用）
#[tauri::command]
pub async fn get_rule_stats(
    state: State<'_, AppState>,
) -> Result<Vec<RuleStats>, String> {
    Ok(state.rule_engine.get_rule_stats())
}
