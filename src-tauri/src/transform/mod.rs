//! 事件转换和处理模块
//! 包含 Heartbeat 合并、数据清洗、分类等功能

pub mod heartbeat;

pub use heartbeat::{heartbeat, HeartbeatManager, HeartbeatResult, TrackEvent, EventData};
