# Influcine Application Updater Architecture

## Overview
This document outlines the robust application updater architecture designed for Influcine. The system enables seamless updates via GitHub Releases, ensuring users always have the latest features and security patches.

## Architecture

The updater follows a **Client-Server** model where:
- **Server**: GitHub Releases (hosts binaries and `latest.yml` metadata).
- **Client (Main Process)**: Electron's `autoUpdater` handles the orchestration (checking, verifying, downloading).
- **Client (Renderer Process)**: React UI provides user feedback and control.

### Data Flow
1.  **Check**: Renderer requests update check -> Main Process queries GitHub -> Returns status.
2.  **Notification**: Main Process detects update -> Sends IPC event to Renderer -> UI shows "Update Available".
3.  **Download**: User clicks "Download" -> Main Process starts download -> Streams progress via IPC -> UI updates progress bar.
4.  **Install**: Download complete -> Main Process notifies Renderer -> User clicks "Restart" -> App restarts and installs.

## Components

### 1. Main Process (`electron/main.ts`)
- **Library**: `electron-updater`
- **Configuration**:
    - `autoDownload: false`: Ensures user consent before consuming bandwidth.
    - `provider: 'github'`: Fetches directly from the repository.
- **IPC Handlers**:
    - `update-check`: Manually triggers a check.
    - `update-download`: Starts the download.
    - `update-install`: Quits and installs.
- **Events**:
    - `update-available`: Payload contains release notes and version.
    - `download-progress`: Payload contains percent, bytes per second.
    - `update-downloaded`: Ready signal.

### 2. Renderer Process (`src/pages/Settings.tsx` & `src/services/updateService.ts`)
- **Service Layer**: `updateService.ts` abstracts IPC calls, providing a clean API for components.
- **UI**: 
    - **System Tab**: A dedicated section in Settings for manual checks and status monitoring.
    - **Visuals**: Progress bars, version badges, and release notes display.

### 3. Build Configuration (`package.json`)
- **Repository**: Linked to `https://github.com/Mbstudio101/influcine`.
- **Publish**: Configured to publish artifacts to GitHub Releases on build.

## User Flows

### Automatic Check (Startup)
1. App launches.
2. `App.tsx` triggers `checkForUpdates()`.
3. If update found, `UpdateModal` appears (non-intrusive).

### Manual Check (Settings)
1. User navigates to **Settings > System**.
2. Clicks **Check for Updates**.
3. Spinner appears.
4. Result displayed: "Up to date" or "Update Available".
5. If available, user clicks **Download**.
6. Progress bar fills.
7. User clicks **Restart & Install**.

## Security & Reliability
- **HTTPS**: All updates are fetched over HTTPS.
- **Validation**: `electron-updater` verifies signatures (if configured) and file integrity.
- **Fallback**: If IPC fails (e.g., in browser mode), the service falls back to a direct GitHub API check and provides a download link.

## Future Improvements
- **Differential Updates**: Enable delta updates to reduce download size.
- **Release Channels**: Support Beta/Alpha channels for testing.
