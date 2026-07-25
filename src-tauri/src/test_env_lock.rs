//! Shared mutex so tests across modules that mutate `GROK_APP_HOME` (a
//! process-global env var) don't race each other under `cargo test`'s default
//! parallel test threads. Every test that calls `std::env::set_var("GROK_APP_HOME", ..)`
//! must hold this lock for its duration.
use std::sync::Mutex;

pub(crate) static ENV_LOCK: Mutex<()> = Mutex::new(());
