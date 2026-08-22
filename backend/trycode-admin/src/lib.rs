pub mod models;
pub mod routes;

use trycode_core::Result;

pub use models::*;
pub use routes::{AdminState, get_system_config, update_system_config, get_system_status, get_admin_stats, list_audit_logs, list_executions_admin, get_execution_admin, list_users_admin, update_user_admin, test_smtp, test_captcha, test_oauth, test_database, initialize_super_admin, trigger_config_reload};