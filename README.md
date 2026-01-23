# Influcine

<div align="center">
  <img src="assets/icon.svg" alt="Influcine Logo" width="120" height="120" />
  <h1>Influcine</h1>
  <p><strong>Your Personal Streaming Companion for TV and Desktop</strong></p>
</div>

---

Influcine is a modern, cross-platform media discovery and streaming application designed for the 10-foot experience (TV) and desktop environments. Built with **React**, **Vite**, **Electron**, and **Capacitor**, it offers a seamless, unified interface whether you're at your desk or on your couch.

## 🌟 Features

- **📺 TV-First Design**: Fully optimized for Android TV with spatial navigation (D-pad support), focus management, and large, readable UI elements.
- **🖥️ Desktop Native**: Runs as a standalone application on macOS, Windows, and Linux via Electron.
- **🎬 Universal Library**: Track your favorite movies and TV shows using the TMDB API.
- **🔍 Smart Discovery**: Powerful search and recommendation engine to find your next watch.
- **⚡ High Performance**: Built on Vite for lightning-fast startup and smooth animations powered by Framer Motion.
- **🔄 Cross-Platform Sync**: (Coming Soon) Sync your watchlist across devices.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Android Studio (for Android TV builds)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/influcine.git
    cd influcine
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    This starts the web server and the Electron app simultaneously.

## 🛠️ Building & Releases

### Where is the App SDK / Installer?

After running a build, the application artifacts ("SDKs" or installers) can be found in the following locations:

#### 🤖 Android TV (APK)
To generate the APK:
1.  Sync the web assets:
    ```bash
    npm run build:web
    npx cap sync android
    ```
2.  Open in Android Studio to build the APK:
    ```bash
    npx cap open android
    ```
    *Or build via command line if Gradle is configured.*

**Location:**
- **Local:** `android/app/build/outputs/apk/debug/app-debug.apk` (Debug build) or `release/` (if signed).
- **GitHub Actions:** Check the **Releases** section of this repository for automatically built APKs.

#### 🖥️ Desktop (macOS, Windows, Linux)
To build the desktop application:
```bash
npm run build
```

**Location:**
- **Local:** The `release/` directory in the project root.
  - macOS: `release/mac/Influcine.app` or `.dmg`
  - Windows: `release/win/Influcine.exe` (if configured)
- **GitHub Actions:** Check the **Releases** section of this repository.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.
