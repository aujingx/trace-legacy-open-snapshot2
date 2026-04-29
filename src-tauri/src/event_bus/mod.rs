//! 统一事件总线
//! 整个系统所有模块通过这里通信，实现松耦合
//!
//! 设计原则：
//! - 所有模块通过事件通信，不直接调用
//! - 发布/订阅模式
//! - 类型安全的事件定义
//! - 可观测、可调试

pub mod types;
pub mod bus;
pub mod commands;

pub use types::*;
pub use bus::{EventBus, SubscriberId, SubscriberCallback};
