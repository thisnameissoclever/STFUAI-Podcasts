# Android Migration & Cross-Device Sync Plan

## Goal
To outline a clear path for extending the "STFUAI Podcasts" application to Android devices and enabling seamless progress synchronization between desktop and mobile.

## User Review Required
> [!IMPORTANT]
> **Sync Architecture Decision**: We need to choose between a "Backend-as-a-Service" (Supabase/Firebase) or a custom backend. Supabase is recommended for speed and relational data handling.

> [!WARNING]
> **Audio Compression on Android**: The current `ffmpeg-static` approach is desktop-only. Android requires a different strategy, likely using native APIs (MediaCodec) or a mobile-optimized FFmpeg library.

## Android Migration Strategy

### 1. Technology Stack Selection
*   **Recommendation**: **Capacitor** with the existing React codebase.
    *   *Why*: Allows reusing 90% of the existing React/TypeScript logic and UI.
    *   *Alternative*: React Native (better performance, but requires rewriting UI).
*   **Framework**: Ionic (optional, but good for mobile UI) or just responsive Tailwind/CSS.

### 2. Audio Compression (The "Blocker")
*   **Problem**: `ffmpeg-static` spawns a node child process, which doesn't exist on Android.
*   **Solution A (Native)**: Use Android's `MediaCodec` API via a Capacitor plugin.
    *   *Pros*: Fast, battery-efficient, built-in.
    *   *Cons*: Limited format control compared to FFmpeg.
*   **Solution B (FFmpeg Mobile)**: Use `ffmpeg-kit-react-native` (or Capacitor equivalent).
    *   *Pros*: Full FFmpeg power.
    *   *Cons*: Increases app size significantly (~20MB+).
*   **Recommendation**: Start with **Solution B** for feature parity, optimize to A later if needed.

### 3. File System & Storage
*   **Desktop**: Direct file system access (`fs`).
*   **Mobile**: Scoped storage.
*   **Migration**: Abstract file operations into a `StorageService` interface.
    *   Desktop implementation: Uses Node `fs`.
    *   Mobile implementation: Uses Capacitor Filesystem API.

## Cross-Device Sync Strategy

### 1. Architecture
*   **Central Source of Truth**: A cloud database (PostgreSQL via Supabase).
*   **Local-First**: App continues to work offline (using existing IndexedDB/SQLite), syncs when online.

### 2. Data to Sync
*   **User Profile**: ID, email, preferences.
*   **Subscriptions**: List of RSS feed URLs.
*   **Playback State**:
    *   `episode_id` (GUID)
    *   `position_seconds`
    *   `is_played`
    *   `last_updated_at`
*   **Queue**: Ordered list of episode GUIDs.

### 3. Auth Provider
*   **Supabase Auth**: Easiest integration with the database. Supports email/password, Google, Apple sign-in.

### 4. Sync Logic (Simplified)
1.  **On App Start**: Fetch latest state from cloud.
    *   *Conflict Resolution*: "Last Write Wins" (based on timestamp).
2.  **On Action (Play/Pause/Finish)**:
    *   Update local DB immediately.
    *   Push update to cloud (debounced, e.g., every 10s during playback).
3.  **Background Sync**: (Mobile only) Periodic fetch to keep state fresh.

## Risks & Blockers
*   **Background Audio**: Android kills background apps aggressively. Need a foreground service for playback.
*   **Data Usage**: Syncing large amounts of metadata (or re-downloading episodes) needs "Wi-Fi only" settings.
*   **Transcription**: Running Whisper/AssemblyAI locally on Android is heavy.
    *   *Mitigation*: Offload transcription to server (if user agrees) or require charging + Wi-Fi for local processing.

## Next Steps
1.  Set up a Supabase project for prototyping sync.
2.  Refactor `StorageService` to be platform-agnostic.
3.  Initialize a Capacitor project in a separate branch to test the build pipeline.
