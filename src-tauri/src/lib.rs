//! Grok App Host — real ACP default (`grok agent stdio`).

mod account;
mod account_profiles;
mod acp_client;
mod agent_prefs;
mod app_update;
mod extensions;
mod supergrok_quota;
mod cli_probe;
mod cli_install;
mod commands;
mod support_bundle;
mod ephemeral_acp;
#[cfg(test)]
mod test_env_lock;
mod editors;
mod error;
mod fs_browser;
mod media_protocol;
mod mock_acp;
mod models_catalog;
mod paths;
mod process_util;
mod process_limits;
mod journal_throttle;
mod stream_stall;
mod terminal;
mod cli_sessions;
mod turn_complete;
mod store_lock;
mod permission;
mod providers;
mod secrets;
mod session_import;
mod session_content_search;
mod session_title;
#[cfg(test)]
mod permission_host_test;
#[cfg(test)]
mod integration_test;
#[cfg(test)]
mod acp_golden_test;
mod session_fsm;
mod session_manager;
mod ssh_tunnel;
mod store;
mod tray;
mod tray_i18n;
mod voice_auth;
mod voice_host;
mod voice_stt;
mod voice_tools;
mod voice_tts;

use std::sync::Arc;

use session_manager::SessionManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = paths::ensure_app_dirs();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let session_mgr = Arc::new(SessionManager::new());
    let terminal_mgr = Arc::new(terminal::TerminalManager::new());
    let voice_host = Arc::new(voice_host::VoiceHost::new());
    let ssh_tunnel_mgr = ssh_tunnel::SshTunnelManager::new();
    let recording_registry = Arc::new(commands::RecordingRegistry::new());

    tauri::Builder::default()
        // Must be registered first so a second process exits and focuses the primary window.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .manage(session_mgr)
        .manage(terminal_mgr)
        .manage(voice_host)
        .manage(ssh_tunnel_mgr)
        .manage(recording_registry)
        // Range-capable media streaming (video/audio/pdf) — never loads multi‑GB into RAM.
        .register_asynchronous_uri_scheme_protocol("media", |_ctx, request, responder| {
            std::thread::spawn(move || {
                let response = media_protocol::handle_request(request);
                responder.respond(response);
            });
        })
        // Close button / Alt+F4 → hide to tray only (no Dock / taskbar icon).
        // Full exit: tray "Quit Grok" or Cmd+Q.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                use tauri::Manager;
                api.prevent_close();
                tray::hide_to_tray(window.app_handle());
            }
        })
        .setup(|app| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "macos")]
                {
                    // Transparent layers so CSS backdrop-filter / native vibrancy show through.
                    let _ = window.set_background_color(Some(tauri::window::Color(0, 0, 0, 0)));
                    // Frosted glass under transparent regions (sidebar). Solid main CSS covers the rest.
                    use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
                    if let Err(e) = apply_vibrancy(
                        &window,
                        NSVisualEffectMaterial::Sidebar,
                        None,
                        Some(16.0),
                    ) {
                        tracing::warn!("window vibrancy: {e}");
                    }
                }
                // Windows / others: solid base matching dark theme (avoids white flash / WebView2 glitches).
                #[cfg(not(target_os = "macos"))]
                {
                    let _ = window.set_background_color(Some(tauri::window::Color(13, 13, 13, 255)));
                }
            }
            // Menu-bar / system tray — logo.svg tray icon (not dock app icon)
            if let Err(e) = tray::setup_tray(app.handle()) {
                tracing::warn!("tray setup: {e}");
            }
            // I03: recycle idle agent processes; session metadata stays on disk.
            // I06: surface cancel UI when a stream is pure-silent for too long.
            {
                use tauri::Manager;
                let mgr = app.state::<Arc<SessionManager>>().inner().clone();
                mgr.start_idle_watchdog(app.handle().clone());
                mgr.start_stream_stall_watchdog(app.handle().clone());
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::session_get_state,
            commands::terminal_spawn,
            commands::terminal_write,
            commands::terminal_resize,
            commands::terminal_snapshot,
            commands::terminal_kill,
            commands::terminal_active_count,
            commands::session_connect,
            commands::session_send,
            commands::session_stop,
            commands::session_disconnect,
            commands::session_park_current,
            commands::session_reattach,
            commands::session_resolve_permission,
            commands::session_resolve_plan,
            commands::session_resolve_ask_user,
            commands::probe_cli,
            commands::acp_test_connection,
            commands::ssh_tunnel_start,
            commands::ssh_tunnel_stop,
            commands::ssh_tunnel_status,
            commands::wsl_list_distros,
            commands::cli_install_latest,
            commands::cli_install_commands,
            commands::pick_cli_binary,
            commands::open_external_url,
            commands::resource_webview_toggle_devtools,
            commands::resource_webview_start_picker,
            commands::resource_webview_stop_picker,
            commands::resource_webview_poll_pick,
            commands::capture_resource_webview,
            commands::start_resource_recording,
            commands::stop_resource_recording,
            commands::save_recording,
            commands::app_check_update,
            commands::cli_check_update,
            commands::projects_list,
            commands::project_add,
            commands::project_add_dialog,
            commands::project_remove,
            commands::project_relocate,
            commands::project_trust,
            commands::project_set_permission_policy,
            commands::project_rename,
            commands::project_set_pinned,
            commands::project_reveal,
            commands::project_archive_sessions,
            commands::sessions_list,
            commands::sessions_search,
            commands::cli_sessions_list,
            commands::cli_session_import,
            commands::cli_sessions_import_all,
            commands::session_create,
            commands::session_delete,
            commands::session_rename,
            commands::session_set_archived,
            commands::session_set_pinned,
            commands::session_set_tags,
            commands::session_set_settled,
            commands::session_set_snoozed,
            commands::session_set_branch_pr,
            commands::session_branch_pr,
            commands::project_config_read,
            commands::session_set_project,
            commands::session_set_scheduled,
            commands::session_messages,
            commands::session_media_root,
            commands::session_resolve_relative_media,
            commands::settings_get,
            commands::settings_set,
            commands::models_list_available,
            commands::composer_prefs_resolve,
            commands::composer_prefs_set,
            commands::session_set_policy,
            commands::session_set_model,
            commands::session_rewind_drop_last_user,
            commands::session_rewind_points,
            commands::session_rewind_execute,
            commands::session_fork,
            commands::secrets_get_masked,
            commands::secrets_set,
            commands::provider_ping,
            commands::import_grok_cli_config,
            commands::import_grok_go_config,
            commands::doctor_report,
            commands::export_support_bundle,
            commands::export_session_bundle,
            commands::reset_app_data,
            commands::skills_list,
            commands::cli_builtin_commands,
            commands::inspect_mcp,
            commands::project_inspect,
            commands::extensions_get,
            commands::extensions_set_mcp,
            commands::extensions_set_skill,
            commands::extensions_enable_all_mcp,
            commands::extensions_enable_all_skills,
            commands::plugins_list,
            commands::plugin_enable,
            commands::plugin_disable,
            commands::plugin_uninstall,
            commands::plugin_details,
            commands::plugin_install,
            commands::plugin_install_with_progress,
            commands::plugin_update,
            commands::plugins_marketplace_catalog,
            commands::get_call_logs,
            commands::clear_call_logs,
            commands::append_call_log,
            commands::export_session,
            commands::load_session_presets,
            commands::save_session_preset,
            commands::delete_session_preset,
            commands::apply_session_preset,
            commands::load_custom_prompts,
            commands::save_custom_prompt,
            commands::delete_custom_prompt,
            commands::load_custom_commands,
            commands::save_custom_command,
            commands::delete_custom_command,
            commands::execute_custom_command,
            commands::set_browser_cookies,
            commands::get_browser_cookies,
            commands::clear_browser_cookies,
            commands::find_agents_files,
            commands::read_agents_file,
            commands::write_agents_file,
            commands::git_stage_file,
            commands::git_unstage_file,
            commands::git_stage_hunk,
            commands::git_get_staged_diff,
            commands::get_notification_settings,
            commands::update_notification_settings,
            commands::is_quiet_hours,
            commands::get_plugin_dependency_graph,
            commands::find_project_memory_workspace,
            commands::list_memory_sessions,
            commands::memory_clear,
            commands::github_fetch,
            commands::github_set_token,
            commands::github_get_token,
            commands::create_issue_from_session,
            commands::get_sync_status,
            commands::set_sync_path,
            commands::migrate_to_sync_path,
            commands::pick_directory,
            commands::pick_attach_files,
            commands::pick_attach_folder,
            commands::save_temp_attachment,
            commands::clipboard_paste_image,
            commands::paths_classify,
            commands::path_open,
            commands::path_reveal,
            commands::git_file_diff,
            commands::git_status,
            commands::git_worktrees_list,
            commands::git_show_file,
            commands::git_staged_diff,
            commands::git_stage_paths,
            commands::git_unstage_paths,
            commands::git_commit,
            commands::git_push,
            commands::git_gh_cli_available,
            commands::git_pr_open,
            commands::acp_ephemeral_prompt,
            commands::fs_list_dir,
            commands::fs_read_file,
            commands::fs_write_file,
            commands::fs_write_absolute,
            tray::tray_refresh,
            commands::fs_read_absolute,
            commands::fs_open_path,
            commands::session_auto_title,
            commands::automations_list,
            commands::automation_create,
            commands::automation_update,
            commands::automation_set_enabled,
            commands::automation_mark_run,
            commands::automation_delete,
            commands::spaces_list,
            commands::space_create,
            commands::space_rename,
            commands::space_delete,
            commands::space_reorder,
            commands::project_set_space,
            commands::account_status,
            commands::account_login,
            commands::account_login_cancel,
            commands::account_logout,
            commands::account_open_usage,
            commands::account_open_subscribe,
            commands::accounts_list,
            commands::account_save_current,
            commands::account_switch,
            commands::account_remove,
            commands::account_rename,
            commands::session_import_transcript,
            commands::session_import_transcript_file,
            commands::providers_list,
            commands::providers_upsert,
            commands::providers_remove,
            commands::providers_set_default,
            commands::providers_activate,
            commands::providers_ping,
            commands::providers_list_models,
            commands::editors_list,
            commands::open_in_editor,
            voice_host::voice_state,
            voice_host::voice_start,
            voice_host::voice_stop,
            voice_host::voice_push_pcm,
            voice_host::voice_invoke_tool,
            voice_host::voice_dictation_transcribe,
            voice_host::voice_list_voices,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Grok App")
        .run(|app, event| {
            // macOS: click Dock icon when all windows hidden → show main window again.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen {
                has_visible_windows,
                ..
            } = event
            {
                if !has_visible_windows {
                    tray::show_main_window(app);
                }
            }
            let _ = (app, &event);
        });
}
