//! 事件总线的 Tauri Commands
//! 提供给前端调用的接口

use super::*;
use crate::AppState;
use tauri::State;

/// 发布一个测试事件（开发调试用）
#[tauri::command]
pub async fn publish_test_event(
    state: State<'_, AppState>,
    event_type: String,
) -> Result<(), String> {
    let event = match event_type.as_str() {
        "app_launched" => TraceEvent::AppLaunched,
        "daily_summary" => TraceEvent::DailySummaryTick,
        "focus_ended" => TraceEvent::FocusSessionEnded {
            duration_seconds: 9000,
            completed: true,
            session_type: "work".to_string(),
        },
        "task_added" => TraceEvent::TaskAdded {
            task_id: uuid::Uuid::new_v4().to_string(),
            title: "测试任务".to_string(),
            estimated_minutes: 60,
            priority: Some(3),
        },
        "distraction" => TraceEvent::DistractionDetected {
            app_switches: 15,
            duration_seconds: 300,
        },
        _ => return Err(format!("Unknown test event type: {}", event_type)),
    };

    state.event_bus.publish(event);
    Ok(())
}

/// 获取最近的事件历史（调试用）
#[tauri::command]
pub async fn get_event_history(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<EventEnvelope>, String> {
    Ok(state.event_bus.get_recent_events(limit.unwrap_or(100)))
}

/// 获取事件总线统计信息
#[tauri::command]
pub async fn get_event_bus_stats(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "history_count": state.event_bus.history_count(),
        "max_history_size": state.event_bus.max_history_size,
    }))
}
