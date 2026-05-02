//! 事件总线核心实现
//! 发布/订阅模式，支持多线程，支持按事件类型订阅

use super::*;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// 订阅者回调函数类型
pub type SubscriberCallback = Arc<dyn Fn(&EventEnvelope) + Send + Sync>;

/// 订阅者 ID
pub type SubscriberId = String;

/// 事件总线
/// 支持：
/// - 发布事件
/// - 订阅所有事件
/// - 订阅特定类型的事件
/// - 取消订阅
/// - 查看最近事件历史
#[derive(Clone)]
pub struct EventBus {
    /// 所有订阅者
    subscribers: Arc<Mutex<HashMap<SubscriberId, SubscriberCallback>>>,
    /// 按事件类型分类的订阅者
    typed_subscribers: Arc<Mutex<HashMap<&'static str, Vec<SubscriberCallback>>>>,
    /// 最近事件历史（最多保留 1000 条）
    event_history: Arc<Mutex<Vec<EventEnvelope>>>,
    /// 历史记录最大长度
    pub max_history_size: usize,
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}

impl EventBus {
    /// 创建新的事件总线
    pub fn new() -> Self {
        Self {
            subscribers: Arc::new(Mutex::new(HashMap::new())),
            typed_subscribers: Arc::new(Mutex::new(HashMap::new())),
            event_history: Arc::new(Mutex::new(Vec::new())),
            max_history_size: 1000,
        }
    }

    /// 创建带自定义历史大小的事件总线
    pub fn with_history_size(max_history_size: usize) -> Self {
        Self {
            subscribers: Arc::new(Mutex::new(HashMap::new())),
            typed_subscribers: Arc::new(Mutex::new(HashMap::new())),
            event_history: Arc::new(Mutex::new(Vec::new())),
            max_history_size,
        }
    }

    /// 发布一个事件
    /// 所有订阅者都会收到通知
    pub fn publish(&self, event: TraceEvent) {
        let envelope = EventEnvelope::wrap(event);

        // 保存到历史
        if envelope.event.should_log() {
            let mut history = self.event_history.lock().unwrap_or_else(|e| e.into_inner());
            history.push(envelope.clone());
            if history.len() > self.max_history_size {
                *history = history.iter().skip(history.len() - self.max_history_size).cloned().collect();
            }
        }

        let event_name = envelope.event.name();

        // 通知所有全量订阅者
        {
            let subscribers = self.subscribers.lock().unwrap_or_else(|e| e.into_inner());
            for callback in subscribers.values() {
                callback(&envelope);
            }
        }

        // 通知按类型订阅的订阅者
        {
            let typed_subs = self.typed_subscribers.lock().unwrap_or_else(|e| e.into_inner());
            if let Some(callbacks) = typed_subs.get(event_name) {
                for callback in callbacks {
                    callback(&envelope);
                }
            }
        }
    }

    /// 订阅所有事件
    /// 返回订阅者 ID，用于取消订阅
    pub fn subscribe_all<F>(&self, callback: F) -> SubscriberId
    where
        F: Fn(&EventEnvelope) + Send + Sync + 'static,
    {
        let subscriber_id = uuid::Uuid::new_v4().to_string();
        let mut subscribers = self.subscribers.lock().unwrap_or_else(|e| e.into_inner());
        subscribers.insert(subscriber_id.clone(), Arc::new(callback));
        subscriber_id
    }

    /// 订阅特定类型的事件
    /// 返回订阅者 ID，用于取消订阅
    pub fn subscribe<F>(&self, event_name: &'static str, callback: F) -> SubscriberId
    where
        F: Fn(&EventEnvelope) + Send + Sync + 'static,
    {
        let subscriber_id = uuid::Uuid::new_v4().to_string();
        let mut typed_subs = self.typed_subscribers.lock().unwrap_or_else(|e| e.into_inner());
        typed_subs
            .entry(event_name)
            .or_default()
            .push(Arc::new(callback));
        subscriber_id
    }

    /// 取消订阅
    /// 注意：对于按类型订阅的，目前实现不支持精确取消
    /// 如果需要取消按类型订阅，请使用 subscribe_all 然后自己过滤
    pub fn unsubscribe(&self, subscriber_id: &SubscriberId) {
        let mut subscribers = self.subscribers.lock().unwrap_or_else(|e| e.into_inner());
        subscribers.remove(subscriber_id);
    }

    /// 获取最近的事件历史
    pub fn get_recent_events(&self, limit: usize) -> Vec<EventEnvelope> {
        let history = self.event_history.lock().unwrap_or_else(|e| e.into_inner());
        history
            .iter()
            .rev()
            .take(limit)
            .cloned()
            .collect()
    }

    /// 获取历史记录总数
    pub fn history_count(&self) -> usize {
        let history = self.event_history.lock().unwrap_or_else(|e| e.into_inner());
        history.len()
    }

    /// 清空历史记录
    pub fn clear_history(&self) {
        let mut history = self.event_history.lock().unwrap_or_else(|e| e.into_inner());
        history.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[test]
    fn test_publish_and_subscribe() {
        let bus = EventBus::new();
        let counter = Arc::new(AtomicUsize::new(0));
        let counter_clone = counter.clone();

        let _sub_id = bus.subscribe_all(move |_event| {
            counter_clone.fetch_add(1, Ordering::SeqCst);
        });

        bus.publish(TraceEvent::AppLaunched);
        bus.publish(TraceEvent::DailySummaryTick);

        std::thread::sleep(std::time::Duration::from_millis(10));
        assert_eq!(counter.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn test_typed_subscribe() {
        let bus = EventBus::new();
        let counter = Arc::new(AtomicUsize::new(0));
        let counter_clone = counter.clone();

        let _sub_id = bus.subscribe("AppLaunched", move |_event| {
            counter_clone.fetch_add(1, Ordering::SeqCst);
        });

        // 这个会触发
        bus.publish(TraceEvent::AppLaunched);
        // 这个不会触发
        bus.publish(TraceEvent::DailySummaryTick);

        std::thread::sleep(std::time::Duration::from_millis(10));
        assert_eq!(counter.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn test_event_history() {
        let bus = EventBus::new();

        bus.publish(TraceEvent::AppLaunched);
        bus.publish(TraceEvent::DailySummaryTick);

        let history = bus.get_recent_events(10);
        assert_eq!(history.len(), 2);
        assert_eq!(bus.history_count(), 2);
    }

    #[test]
    fn test_history_limit() {
        let bus = EventBus::with_history_size(5);

        for _ in 0..10 {
            bus.publish(TraceEvent::AppLaunched);
        }

        assert_eq!(bus.history_count(), 5);
    }

    #[test]
    fn test_unsubscribe() {
        let bus = EventBus::new();
        let counter = Arc::new(AtomicUsize::new(0));
        let counter_clone = counter.clone();

        let sub_id = bus.subscribe_all(move |_event| {
            counter_clone.fetch_add(1, Ordering::SeqCst);
        });

        bus.publish(TraceEvent::AppLaunched);
        std::thread::sleep(std::time::Duration::from_millis(10));
        assert_eq!(counter.load(Ordering::SeqCst), 1);

        bus.unsubscribe(&sub_id);

        bus.publish(TraceEvent::AppLaunched);
        std::thread::sleep(std::time::Duration::from_millis(10));
        // 取消订阅后不应该再增加
        assert_eq!(counter.load(Ordering::SeqCst), 1);
    }
}
