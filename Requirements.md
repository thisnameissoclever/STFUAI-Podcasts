# AI Podcatcher App - Comprehensive Requirements

## Overview

Create a production-ready podcast application (podcatcher) that is heavily modeled after "Pocket Casts". The application must use real, live data only — no example or demo data. The app must run locally on the user's computer with full support for downloading and storing large podcast episode files to local storage.

NOTE: You CANNOT run this app properly in a browser, because it requires access to the user's local file system and other features that are only available in a desktop application. The app must be run as a desktop application; otherwise, you won't be able to download, transcribe, or detect ads in a podcast episode. 

---

# Tech Stack

The application is built using **Electron** to enable desktop functionality with local file storage capabilities. This architecture allows the app to:
- Download large audio files to the user's local filesystem
- Access native OS features (file system, native protocols)
- Run as a standalone desktop application on Windows, macOS, and Linux

## Core Technologies

### Frontend
- **Framework**: React 19.2.0+ with TypeScript
- **Routing**: React Router DOM (v7.9.6+)
- **State Management**: Zustand (v5.0.8+) for global state
- **Styling**: Vanilla CSS with CSS variables (dark mode first)
- **UI Icons**: Lucide React (v0.554.0+)
- **Build Tool**: Vite (v7.2.2+)

### Backend/Desktop
- **Runtime**: Electron (v39.2.3+)
- **IPC**: Electron IPC for renderer-main process communication
- **File Operations**: Node.js `fs` module for local file management
- **Audio Processing**: FFmpeg (via `ffmpeg-static` v5.3.0+) for audio compression

### Data & Storage
- **Local Database**: IndexedDB via `idb-keyval` (v6.2.2+) for persistent storage
- **Storage Location**: Electron's `app.getPath('userData')/podcasts` directory

### External APIs
- **Podcast Data**: Podcast Index API (https://api.podcastindex.org)
- **Transcription Services**: 
  - OpenAI Whisper API (default)
  - Google Cloud Speech-to-Text API (alternative)
- **HTTP Client**: Axios (v1.13.2+)

### Development Tools
- **TypeScript**: v5.9.3+
- **ESLint**: v9.39.1+ with React plugins
- **Bundler**: esbuild (v0.27.0+) for Electron main process
- **Process Management**: Concurrently for running dev servers

---

# Application Architecture

## Directory Structure
```
/electron            # Electron main process and preload scripts
/src
  /components        # React components (Layout, Player, Sidebar, etc.)
  /pages            # Route pages (Discover, Library, Search, Settings, PodcastDetail)
  /services         # Business logic (api, storage, transcription, db, auth)
  /store            # Zustand stores (usePodcastStore, usePlayerStore)
  /types            # TypeScript interfaces
/public             # Static assets
```

---

# Features - Detailed Requirements

## 1. Podcast Index API Integration

Reminder: Never, EVER create, create or use example or demo data. Use real, live data only. 

### Authentication Method
Use SHA-1 HMAC-based authentication:
1. Generate timestamp: `Math.floor(Date.now() / 1000)`
2. Create data string: `API_KEY + API_SECRET + timestamp`
3. Hash with SHA-1 using Web Crypto API: `crypto.subtle.digest('SHA-1', dataBuffer)`
4. Send headers:
   - `X-Auth-Date`: timestamp (string)
   - `X-Auth-Key`: API_KEY
   - `Authorization`: SHA-1 hash (hex string)

### Required Endpoints
- `GET /search/byterm?q={query}` - Search podcasts by term
- `GET /podcasts/byfeedid?id={id}` - Get podcast details
- `GET /episodes/byfeedid?id={id}&max={max}` - Get episodes for a podcast
- `GET /podcasts/trending?max={max}` - Get trending podcasts

### Implementation Notes
- Use Axios with request interceptors to add auth headers automatically
- Do NOT set User-Agent header (browsers block this)
- Handle rate limiting and errors gracefully

## 2. Data Persistence (No Login Required)

All user data must persist locally without authentication. Use IndexedDB (via `idb-keyval`) to store:

### Stored Data
1. **Subscriptions**: Keyed by podcast feed ID
2. **Episodes**: Keyed by episode ID, includes:
   - Download status and local file path
   - Play status (including whether the episode has been marked as played and the position of the play-head within the episode)
   - Queue status (whether the episode is in the queue)
   - Transcription status and data
3. **Queue**: Ordered list of episodes to play
4. **Player State**: Current episode, playback position, playback rate
5. **User Preferences**: Playback speed, theme, transcription provider, compression quality
6. **Played Episodes**: Episodes that have been marked as played (either manually or automatically after the end of the episode has been reached)

### Persistence Requirements
- Load all state on app startup from IndexedDB
- Save state changes immediately (on every mutation)
- Queue order must persist across app restarts
- Playback position must be saved continuously (at least every 2-5 seconds)
- Settings changes must persist immediately

## 3. Discover & Search

### Discover Page
- Display trending podcasts on load using `/podcasts/trending?max=10`
- Show podcast cards in a responsive grid (2-5 columns depending on screen size)
- Each card shows: podcast artwork, title, author
- Click on card navigates to podcast detail page

### Search Page
- Search input at top of page
- Search as user types (with debounce, 300ms)
- Query `/search/byterm?q={query}`
- Display results in grid format (same as Discover)
- Show "No results" message if search returns empty
- Show loading indicator while searching

### Podcast Detail Page
- Fetch podcast details and episodes using `/episodes/byfeedid`
- Display podcast artwork, title, author, description
- Show subscribe/unsubscribe button (toggle subscription status)
- List all episodes with:
  - Episode artwork (or podcast artwork as fallback)
  - Title and publication date
  - Duration
  - Download status indicator
  - Play button
  - "Played" checkmark overlay if episode has been played
- Episodes should be sortable by date (newest first by default)
- Clicking episode or play button should:
  1. Download episode if not already downloaded
  2. Add to queue if not in queue
  3. Start playing episode

## 4. Library (Subscriptions) Page

### Page Name
- Display as "Subscriptions" in navigation
- Route: `/library`
- Page title: "Your Subscriptions"

### Functionality
- Load and display all subscribed podcasts from local storage
- Show empty state with "Find Podcasts" button if no subscriptions
- Display podcasts in responsive grid (same layout as Discover)
- Click on podcast navigates to podcast detail page
- Persist subscriptions across app restarts

## 5. Episode Queue Management

### Queue Behavior
- Episodes are automatically added to queue when:
  1. User subscribes to a podcast (add latest unplayed episodes)
  2. User clicks play on an episode (auto-downloads)
  3. User explicitly adds episode to queue (auto-downloads)
- Queue is ordered (FIFO by default)
- Queue persists across app restarts

### Queue Operations
- **View Queue**: Accessible via a dedicated button in the top-right of the player UI (opens as an overlay)
- **Reorder**: Drag-and-drop functionality to reorder queue items
- **Remove**: Swipe or delete button to remove from queue
- **Mark as Played**: Button on each queue item
- **Auto-advance**: When episode finishes, automatically play next in queue

### Queue UI Requirements
- Display episode artwork, title, podcast name, duration
- Show download status for each episode
- Visual indicator for currently playing episode
- Empty state when queue is empty

## 6. Audio Playback System

### Player State Management (Zustand Store)
```typescript
interface PlayerState {
  currentEpisode: Episode | null;
  isPlaying: boolean;
  playbackRate: number;        // 0.5 to 2.5
  queue: Episode[];
  currentTime: number;          // seconds
  duration: number;             // seconds
  isPlayerOpen: boolean;        // true if full player visible
}
```

### Playback Controls
- **Play/Pause**: Toggle playback
- **Skip Forward**: Jump ahead 30 seconds
- **Skip Backward**: Jump back 20 seconds
- **Seek**: Scrub to any position via progress bar
- **Playback Speed**: Variable speed from 0.5x to 2.5x (increments of 0.05)
- **Next**: Play next episode in queue
- **Volume**: Control audio volume (0.0 to 1.0)

### File Playback
- Always play from local file (never stream directly from URL)
- Use custom protocol `local-media://` registered in Electron
- Audio element source: `local-media://${filename}`
- Files stored in: `app.getPath('userData')/podcasts/${episodeId}.mp3`

### Playback State Persistence
- Save current position every 5 seconds
- Save on pause, seek, or app close
- Restore position on app restart if episode was in progress

### Auto-play Next
- When episode reaches end (currentTime >= duration):
  1. Mark current episode as played
  2. Remove from queue
  3. Delete episode file from local storage (IMMEDIATELY upon marking as played)
  4. Play next episode in queue (if any)
  5. If queue is empty, stop playback

## 7. Variable Speed Playback

### Speed Range
- Minimum: 0.5x
- Maximum: 2.5x
- Increment: 0.05 (allowing any value with up to 2 decimal places)
- Default: 1.0x (user-configurable in settings)

### Speed Selection UI
- Clicking current speed indicator opens speed picker modal/dropdown
- Display common speeds: 0.5x, 0.75x, 1.0x, 1.25x, 1.5x, 1.75x, 2.0x, 2.5x
- Allow custom input for precise values (validated range 0.5-2.5)
- Apply speed immediately when selected
- Speed persists across episodes and app restarts

### Settings Integration
- Settings page has "Default Playback Speed" option
- When user changes default, it applies to new episodes
- Currently playing episode retains its current speed

## 8. Mark as Played

### Trigger Actions
Episodes are marked as played when:
1. User clicks "Mark as Played" button (from player UI or queue)
2. Episode playback completes (currentTime >= duration)

### Side Effects (Execute in Order)
1. Set `isPlayed: true` on episode in database
2. Remove episode from queue
3. Delete episode audio file from local storage (`${episodeId}.mp3`)
4. Delete compressed file if exists (`${episodeId}-compressed.mp3`)
5. Remove from in-memory player queue
6. If this was current episode and auto-play enabled, play next episode

### Visual Indicators
- Played episodes in podcast episode list show checkmark/done icon overlay
- Played episodes are grayed out or have reduced opacity
- Played episodes do NOT re-appear in queue
- Played episodes still visible in podcast detail page (for reference/replay)

### Replay Functionality
- Clicking on a played episode allows replaying it
- Replaying downloads the file again
- Replaying does NOT add to queue unless explicitly added

## 9. File Download System

### Download Triggers
Episodes are downloaded AUTOMATICALLY when:
1. User clicks play on an episode
2. Episode is added to queue

Note: The explicit "Download" button is removed. Only episodes being played or in the queue should be downloaded.

### Download Process (IPC Handler: `download-file`)
1. Check if file already exists: `{episodeId}.mp3`
2. If exists, return cached file path
3. If not exists:
   - Fetch audio file from `episode.enclosureUrl` using `electron.net.fetch()`
   - Stream to local file using Node.js streams (`pipeline`)
   - Save to: `app.getPath('userData')/podcasts/{episodeId}.mp3`
   - Update episode record: `isDownloaded: true`, `localFilePath: <path>`
4. Persist episode state to IndexedDB

### Download Status Indicators
- Show download progress (percentage/spinner) during download
- Show download icon when file is downloaded
- Show download error if download fails
- Allow retry on failed downloads

### File Management
- Downloaded files persist until:
  1. Episode is marked as played (file auto-deleted immediately)
  2. Episode is removed from the queue (file auto-deleted immediately)
  3. User clears all app data from developer settings
- Track disk usage (optional: display in settings)

---

# Player UI - Detailed Specifications

## Small Player (Persistent Bottom Bar)

### Layout
- **Position**: Fixed at bottom of screen, always visible
- **Height**: 80px
- **Background**: Dark with slight transparency/blur effect
- **Z-index**: High (above main content)

### Elements (Left to Right)
1. **Episode Artwork** (60px × 60px)
   - Show `episode.image` if available, else `podcast.artwork`
   - Rounded corners (8px border-radius)
   - Clickable to open full player

2. **Episode Info** (Flex-grow)
   - **Title**: Episode title (1 line, ellipsis overflow)
   - **Podcast Name**: Podcast title (1 line, smaller text, muted color)

3. **Playback Controls** (Center group)
   - **Skip Back Button** (−20s icon)
   - **Play/Pause Button** (Large, primary accent color)
   - **Skip Forward Button** (+30s icon)

4. **Progress Bar** (Below controls, full width)
   - Show current time / total duration
   - Scrubber shows playback position
   - Clickable/draggable to seek
   - Update in real-time during playback

5. **Playback Speed Indicator** (Right side)
   - Display current speed (e.g., "1.0x")
   - Clickable to open speed picker

### Interactions
- Clicking anywhere on bar (except buttons) opens full player
- Progress bar is interactive (click/drag to seek)
- Controls function identically to full player

## Full Player UI

### Layout
- **Display Mode**: Full-screen overlay OR slide-up panel (slide animation)
- **Background**: Dark gradient or solid dark background
- **Close Button**: Down arrow icon (top-right) to return to small player

### Elements (Top to Bottom)

1. **Header**
   - Close button (down arrow, top-right)
   - Close button (down arrow, top-right)
   - Queue button (top-right, next to close button) - Opens Queue Overlay

2. **Artwork Display** (Large, centered)
   - 400px × 400px (or responsive max size)
   - Show `episode.image` or fallback to `podcast.artwork`
   - Subtle shadow/glow effect
   - Optional: Rotate animation when playing

3. **Episode Information**
   - **Episode Title** (Large, bold, white)
   - **Podcast Name** (Medium, muted color, clickable to podcast detail)
   - **Publication Date** (Small, muted)

4. **Progress Control**
   - **Current Time** (left) / **Total Duration** (right)
   - **Progress Bar** (thick, interactive, accent color)
   - Visual feedback on hover/drag

5. **Playback Controls** (Large buttons, centered)
   - **Skip Back** (−20s)
   - **Play/Pause** (Extra large, primary button)
   - **Skip Forward** (+30s)

6. **Secondary Controls** (Row of icon buttons)
   - **Playback Speed** (Display current speed, clickable)
   - **Mark as Played** (Checkmark icon)
   - **Add to Queue / Show Queue** (Queue icon, badge with count)
   - **Transcribe Button** (Microphone icon, shows transcription status)

7. **Episode Description** (Expandable Section, BELOW controls)
   - **Collapsed**: Show first 3 lines with "Show More" button
   - **Expanded**: Show full description, "Show Less" button
   - Support HTML formatting if present in description
   - Auto-link URLs

8. **Transcript** (Expandable Section, below description)
   - **Collapsed by default**: "Show Transcript" button
   - **If NOT transcribed**: Show "Transcribe Episode" button
     - Clicking starts transcription process
     - Show loading indicator during transcription
   - **If transcribed**: Display transcript text
     - Segmented by timestamps
     - Each segment shows timestamp (clickable to seek to that position)
     - Highlight current segment based on playback position
     - Scrollable, tall container
   - **If transcription failed**: Show error message and retry button

### Playback Speed Picker (Modal/Dropdown)
- Trigger: Click playback speed indicator
- Display: Modal or dropdown menu
- Options:
  - Preset speeds in grid/list: 0.5x, 0.75x, 1.0x, 1.25x, 1.5x, 1.75x, 2.0x, 2.5x
  - Custom input field (validates 0.5-2.5, increments of 0.05)
- Selection applies immediately
- Close modal after selection

### Queue View (Overlay)
- Trigger: Click Queue button in top-right of Full Player
- Display: Overlay on top of player
- Layout: Vertical list
- Each item shows:
  - Small artwork thumbnail
  - Episode title & podcast name
  - Duration
  - Reorder handle (drag icon)
  - Remove button (×) - Removing deletes the downloaded file
  - Play button (if not currently playing)
- Current episode highlighted
- Drag-and-drop to reorder
- Swipe to delete (mobile) or hover delete button

---

# Settings Page

### Navigation
- Route: `/settings`
- Accessible from sidebar navigation

### Settings Sections

#### 1. Playback Preferences
- **Default Playback Speed**
  - Dropdown: 0.5x to 2.5x (same options as player speed picker)
  - Applies to new episodes when started
- **Default Volume**
  - Slider: 0 to 100%
- **Auto-play Next Episode**
  - Toggle: On/Off
  - When on, automatically plays next episode in queue when one finishes
- **Skip Forward Interval**
  - Input: Seconds (default: 30)
- **Skip Backward Interval**
  - Input: Seconds (default: 20)

#### 2. Appearance
- **Theme**
  - Radio buttons: Dark Mode (default) / Light Mode
  - Apply immediately on change

#### 3. Transcription Settings
- **Transcription Provider**
  - Radio buttons: OpenAI Whisper (default) / Google Speech-to-Text
  - Description of each provider
- **Audio Compression Quality** (Developer Setting)
  - Dropdown: 32 kbps / 64 kbps (default) / 96 kbps / 128 kbps
  - Info text: "Lower bitrate = faster transcription, lower cost, but reduced quality"
  - Note: Compression is applied before sending to transcription service

#### 4. Storage & Data
- **Storage Location**
  - Display current path: `app.getPath('userData')/podcasts`
  - Button: "Open Folder" (opens folder in file explorer)
- **Storage Usage**
  - Display total size of downloaded episodes
  - Display number of downloaded episodes
- **Clear Downloaded Episodes**
  - Button: "Delete All Downloads"
  - Shows confirmation dialog
  - Deletes all episode files but retains metadata

#### 5. Developer Settings
- **Clear All User Data**
  - Button: "Clear All Data" (destructive action, red button)
  - Shows confirmation dialog with warning
  - Clears:
    - All subscriptions
    - All downloaded files
    - Queue
    - Playback history
    - User preferences (reset to defaults)
    - All transcripts
  - Requires app restart after clearing
- **Show Debug Logs**
  - Toggle: Enable verbose console logging
- **API Endpoints**
  - Display configured API endpoints (read-only)

### Persistence
- All settings changes save immediately to IndexedDB
- Settings load on app startup and apply globally

---

# Transcription System - Detailed Requirements

## Core Principles

### Critical Requirement: File Integrity
**The exact audio file that the user plays MUST be the same file sent for transcription.**

Reasoning:
- Podcast feeds often inject dynamic ads based on geographic location, user agent, or time of download
- Downloading the file twice (once for playback, once for transcription) may result in different ad placements or durations
- Solution: Download episode file once to local storage; send that local file to transcription service

### Workflow
1. Episode is downloaded to: `{userData}/podcasts/{episodeId}.mp3`
2. When user requests transcription:
   - Compress the local file to reduce cost/speed (using FFmpeg)
   - Send compressed file to transcription API
   - Compressed file: `{userData}/podcasts/{episodeId}-compressed.mp3`
3. Receive timestamped transcript
4. Store transcript in IndexedDB keyed by `episodeId`
5. Display transcript in player UI

### No Streaming for Transcription
- Do NOT send the `enclosureUrl` directly to transcription service
- Do NOT stream from URL for transcription
- Always use the downloaded local file

## Audio Compression (Pre-transcription)

### Purpose
- Reduce file size before uploading to transcription API
- Reduce API costs (charged per audio minute/size)
- Speed up upload time

### Implementation (IPC Handler: `compress-audio`)
- Use FFmpeg (`ffmpeg-static` package)
- Command: `ffmpeg -i input.mp3 -b:a {bitrateKbps}k -ac 1 -y output-compressed.mp3`
  - `-b:a {bitrate}k`: Set audio bitrate (32, 64, 96, or 128 kbps)
  - `-ac 1`: Convert to mono (speech doesn't need stereo)
  - `-y`: Overwrite output file if exists
- Output file: `{episodeId}-compressed.mp3`
- Return path to compressed file

### Compression Quality Settings (User-Configurable)
- **32 kbps**: Fastest, smallest, lowest quality (acceptable for speech)
- **64 kbps**: Default, good balance
- **96 kbps**: Higher quality
- **128 kbps**: Best quality, larger file

### Error Handling
- If FFmpeg fails, fallback to uncompressed file
- Log error but continue transcription process

## Transcription Providers

### Provider: OpenAI Whisper (Default)

#### API Configuration
- **Endpoint**: `https://api.openai.com/v1/audio/transcriptions`
- **API Key**: Set `VITE_OPENAI_API_KEY` in `.env` file (see `.env.example`)
- **Model**: `whisper-1`

#### Request Format (multipart/form-data)
```
POST /v1/audio/transcriptions
Headers:
  Authorization: Bearer {API_KEY}
Body (form-data):
  file: <audio file binary>
  model: "whisper-1"
  response_format: "verbose_json"
  timestamp_granularities: ["word", "segment"]
```

#### Response Format
```json
{
  "task": "transcribe",
  "language": "en",
  "duration": 1234.56,
  "text": "Full transcript text...",
  "segments": [
    {
      "id": 0,
      "start": 0.0,
      "end": 5.2,
      "text": "Segment text",
      "words": [
        { "word": "Hello", "start": 0.0, "end": 0.5 },
        { "word": "world", "start": 0.6, "end": 1.0 }
      ]
    }
  ]
}
```

#### Processing Steps
1. Read compressed audio file as Buffer
2. Create FormData with file and parameters
3. POST to OpenAI endpoint with Authorization header
4. Parse response into `Transcript` type
5. Save to database with `episodeId`

### Provider: Google Speech-to-Text (Alternative)

#### Request Format (JSON)
```json
{
  "config": {
    "encoding": "MP3",
    "sampleRateHertz": 16000,
    "languageCode": "en-US",
    "enableWordTimeOffsets": true,
    "enableAutomaticPunctuation": true
  },
  "audio": {
    "content": "<base64-encoded audio>"
  }
}
```

#### Processing Steps
1. Read compressed audio file
2. Encode file as base64
3. Build request JSON
4. POST to Google endpoint with API key query param
5. Transform Google response format to our `Transcript` type
6. Save to database

#### Response Transformation
- Google returns `results[].alternatives[].words[]` with `startTime` and `endTime` (as duration strings)
- Convert duration strings to seconds
- Group words into segments (logical sentences/pauses)
- Build `Transcript` object matching our schema

## Transcription UI/UX

### Transcribe Button (in Full Player)
- Icon: Microphone or closed captions icon
- States:
  - **Not Transcribed**: Default button, label "Transcribe"
  - **Processing**: Spinner/loading indicator, disabled, label "Transcribing..."
  - **Completed**: Checkmark icon, label "View Transcript"
  - **Failed**: Warning icon, label "Retry Transcription"

### Transcription Status Tracking
- Store in episode record: `transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed'`
- Update status in real-time during transcription process

### Transcript Display
- Shown in expandable section below episode description
- If transcript exists:
  - Display segments sequentially
  - Each segment shows:
    - Timestamp (e.g., "1:23") - clickable to seek to that position
    - Text content
  - Auto-scroll to current segment during playback (optional enhancement)
  - Highlight current segment based on playback time
- If no transcript:
  - Show "Transcribe Episode" button
  - Clicking triggers transcription process

### Error Handling
- If transcription fails:
  - Update status to 'failed'
  - Show error message: "Transcription failed. Please try again."
  - Allow retry button
  - Log error details to console for debugging

### Cost Awareness (Optional Info Display)
- Show estimated cost/time before transcription (based on episode duration)
- Example: "This episode is 45 minutes. Transcription may take 2-3 minutes."

---

# API Keys & Credentials (Do Not Remove)

### OpenAI API
- **API Key**: Set `VITE_OPENAI_API_KEY` in `.env` file (see `.env.example`)

**Note**: These credentials are for development purposes. In production, use environment variables or secure credential storage.

---

# Additional Features & Enhancements

## Content Security Policy
- Implemented in Electron main process
- Allow scripts, styles, images, media from appropriate sources
- Whitelist external API domains:
  - `https://api.podcastindex.org`
  - `https://api.openai.com`
  - `https://speech.googleapis.com`
- Allow `blob:` and `data:` URIs for media playback
- Block unsafe inline scripts (except where explicitly needed for Vite dev)

## Navigation & Routing
- **Routes**:
  - `/` - Discover (Home)
  - `/search` - Search podcasts
  - `/library` - Subscriptions
  - `/podcast/:id` - Podcast detail page
  - `/settings` - Settings page
- **Sidebar Navigation**: Always visible, highlight current route
- **Browser-style navigation**: Back/forward buttons work correctly

## Responsive Design
- Desktop-first design (primary target)
- Minimum width: 1024px recommended
- Grid layouts adapt to screen size:
  - Small screens: 2 columns
  - Medium screens: 3 columns
  - Large screens: 4-5 columns

## Dark Mode (Default)
- Default theme is dark mode
- Color scheme:
  - Background: `#1a1a1a`
  - Surface: `#2a2a2a`
  - Text primary: `#ffffff`
  - Text secondary: `#b0b0b0`
  - Accent color: `#00d9ff` (bright cyan/blue)
  - Accent hover: `#00b8d4`
- Light mode optional (user can toggle in settings)

## Error Handling & User Feedback
- Show loading spinners during async operations (search, downloads, transcription)
- Display error messages for failed operations (network errors, API failures)
- Toast notifications (optional) for:
  - Episode added to queue
  - Download completed
  - Transcription completed
  - Episode marked as played

## Performance Optimizations
- Lazy load episode lists (virtual scrolling for large lists)
- Debounce search input (300ms)
- Cache API responses where appropriate
- Optimize image loading (use thumbnails in grids, full-size in detail views)

## Logging
- Console logging for all major operations (downloads, transcriptions, playback events)
- Prefix logs with service name (e.g., `[Transcription]`, `[ffmpeg]`, `[Storage]`)
- Error objects logged with full stack traces

## Future Features (Not Yet Implemented)
- **AI Ad-Break Detection**: Use transcripts to detect and skip ads (future phase)
- **Podcast Recommendations**: AI-based suggestions
- **Chapter Support**: If podcasts include chapter markers
- **Cloud Sync**: Sync subscriptions/progress across devices
- **Playlist Creation**: Custom playlists beyond queue
- **Export/Import**: Backup and restore subscriptions and settings

---

# Development & Build Instructions

## Development Mode
```bash
npm run dev
```
- Starts Vite dev server (React frontend) on port 5173
- Builds Electron main process with esbuild
- Launches Electron app with hot reload

## Production Build
```bash
npm run build
```
- Compiles TypeScript frontend with Vite
- Bundles Electron main/preload scripts with esbuild
- Packages app with electron-builder for distribution

## Project Structure
- `electron/main.ts` - Electron main process (IPC handlers, window management)
- `electron/preload.ts` - Preload script (exposes IPC to renderer via `window.electron`)
- `src/` - React frontend application
- `dist-electron/` - Compiled Electron scripts
- `dist/` - Compiled frontend assets

---

# Implementation Notes for AI

When building this application:

1. **Use exact TypeScript interfaces** defined in this document for type safety
2. **Implement IndexedDB persistence** on every state mutation (subscriptions, queue, episodes, settings)
3. **Always download files first**, never stream URLs directly to transcription
4. **Implement IPC handlers** in Electron main process for file operations (download, delete, compress)
5. **Use Zustand stores** for global state (podcasts, player) with persistence middleware
6. **Ensure UI matches specifications** (two-player system, expandable sections, queue view)
7. **Handle all async operations** with loading states and error boundaries
8. **Test transcription** with both providers (Whisper and Google) to ensure compatibility
9. **Validate user inputs** (playback speed range, compression quality, etc.)
10. **Log all operations** for debugging and monitoring

This specification should provide complete guidance for building the AI Podcatcher application from scratch.