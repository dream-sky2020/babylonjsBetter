use std::{
  fs,
  path::PathBuf,
  sync::Mutex,
  thread,
  time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, PhysicalPosition, Position, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PetStatePayload {
  mood: String,
  animation_speed: f32,
}

#[derive(Debug, Clone, Serialize)]
struct HeartbeatPayload {
  unix_ms: u128,
}

struct AppState {
  pet_state: Mutex<PetStatePayload>,
}

const SPRITE_PRESETS_FILENAME: &str = "sprite-anchor-presets.json";

fn sprite_presets_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let app_data_dir = app
    .path()
    .app_data_dir()
    .map_err(|error| format!("resolve app data dir failed: {error}"))?;
  if !app_data_dir.exists() {
    fs::create_dir_all(&app_data_dir).map_err(|error| format!("create app data dir failed: {error}"))?;
  }
  Ok(app_data_dir.join(SPRITE_PRESETS_FILENAME))
}

#[tauri::command]
fn pet_get_state(state: State<'_, AppState>) -> Result<PetStatePayload, String> {
  state
    .pet_state
    .lock()
    .map(|payload| payload.clone())
    .map_err(|error| format!("lock error: {error}"))
}

#[tauri::command]
fn pet_set_state(
  app: tauri::AppHandle,
  state: State<'_, AppState>,
  payload: PetStatePayload,
) -> Result<PetStatePayload, String> {
  let updated = {
    let mut guard = state
      .pet_state
      .lock()
      .map_err(|error| format!("lock error: {error}"))?;
    *guard = payload.clone();
    guard.clone()
  };

  let _ = app.emit("pet://state_changed", updated.clone());
  Ok(updated)
}

#[tauri::command]
fn sprite_presets_read_json(app: tauri::AppHandle) -> Result<String, String> {
  let path = sprite_presets_path(&app)?;
  if !path.exists() {
    return Ok("{}".to_string());
  }
  fs::read_to_string(path).map_err(|error| format!("read sprite presets failed: {error}"))
}

#[tauri::command]
fn sprite_presets_write_json(app: tauri::AppHandle, json: String) -> Result<(), String> {
  let path = sprite_presets_path(&app)?;
  fs::write(path, json).map_err(|error| format!("write sprite presets failed: {error}"))
}

#[tauri::command]
fn switch_to_pet_mode(app: tauri::AppHandle) -> Result<(), String> {
  let game_window = app
    .get_webview_window("game")
    .ok_or_else(|| "game window not found".to_string())?;
  let pet_window = app
    .get_webview_window("pet")
    .ok_or_else(|| "pet window not found".to_string())?;

  pet_window.show().map_err(|error| format!("show pet window failed: {error}"))?;
  pet_window
    .set_focus()
    .map_err(|error| format!("focus pet window failed: {error}"))?;
  game_window.hide().map_err(|error| format!("hide game window failed: {error}"))?;
  Ok(())
}

#[tauri::command]
fn switch_to_game_mode(app: tauri::AppHandle) -> Result<(), String> {
  let game_window = app
    .get_webview_window("game")
    .ok_or_else(|| "game window not found".to_string())?;
  let pet_window = app
    .get_webview_window("pet")
    .ok_or_else(|| "pet window not found".to_string())?;

  game_window.show().map_err(|error| format!("show game window failed: {error}"))?;
  game_window
    .set_focus()
    .map_err(|error| format!("focus game window failed: {error}"))?;
  pet_window.hide().map_err(|error| format!("hide pet window failed: {error}"))?;
  Ok(())
}

fn unix_ms_now() -> u128 {
  match SystemTime::now().duration_since(UNIX_EPOCH) {
    Ok(duration) => duration.as_millis(),
    Err(_) => 0,
  }
}

fn main() {
  tauri::Builder::default()
    .manage(AppState {
      pet_state: Mutex::new(PetStatePayload {
        mood: "idle".to_string(),
        animation_speed: 1.0,
      }),
    })
    .invoke_handler(tauri::generate_handler![
      pet_get_state,
      pet_set_state,
      sprite_presets_read_json,
      sprite_presets_write_json,
      switch_to_pet_mode,
      switch_to_game_mode
    ])
    .setup(|app| {
      if let Some(window) = app.get_webview_window("pet") {
        if let Ok(Some(monitor)) = window.current_monitor() {
          if let Ok(size) = window.outer_size() {
            let monitor_pos = monitor.position();
            let monitor_size = monitor.size();
            let x = monitor_pos.x + 16;
            let y = monitor_pos.y + monitor_size.height as i32 - size.height as i32 - 16;
            let _ = window.set_position(Position::Physical(PhysicalPosition::new(x, y)));
          }
        }
        let _ = window.hide();
      }

      let app_handle = app.handle().clone();
      thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(5));
        let payload = HeartbeatPayload {
          unix_ms: unix_ms_now(),
        };
        let _ = app_handle.emit("pet://heartbeat", payload);
      });

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
