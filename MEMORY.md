# SychBoard Project Memory

## Project Overview
SychBoard is a personal, AI-powered life dashboard built with Electron and Vanilla Web Technologies (HTML/CSS/JS). It functions as both a packaged Windows desktop application and a Progressive Web App (PWA) hosted via GitHub Pages.

## Core Architecture
- **Frontend:** `src/index.html`, `src/styles.css`, `src/renderer.js`. 
- **State Management:** All data is stored in a global `st` object and synchronized to `localStorage` (prefixed with `sb4_`).
- **Backend:** `main.js` handles Electron window creation, native OS notifications, and HTTPS requests to bypass CORS for specific APIs (Trading 212, YouTube).
- **Preload:** `preload.js` bridges the frontend and backend using `contextBridge`.
- **CI/CD:** `.github/workflows/release.yml` automatically bumps the version, builds the Windows `.exe`, creates a GitHub Release, and deploys the PWA to GitHub Pages on every push to `main`.

## Security & API Keys
- **No `.env` file is pushed to GitHub.** The `.gitignore` successfully protects local secrets.
- **Developer Mode:** To prevent exposing keys, the app has a secret UI panel. If the user's name is set to `Daniel` or `Daniel6767`, a "Developer API Keys" section unlocks in the Settings tab.
- Keys (Groq, Trading 212, YouTube) are saved directly to `localStorage` encrypted by the OS, meaning the `.exe` needs no hardcoded secrets.

## Features Implemented
1.  **AI Assistant (Groq):** Powered by `llama-3.3-70b-versatile`. 
    - Injects the user's entire state (wealth, habits, sleep, goals, current time) into the system prompt.
    - Uses a custom tagging system (`[ADD_TODO:text]`, `[NAVIGATE:id]`, `[SET_BALANCE:bank:50]`) to allow the AI to actively manipulate the user's dashboard.
2.  **Habit Tracker:** Tracks daily habits with a 30-day GitHub-style contribution heatmap and a Confetti particle explosion when all daily habits are checked off.
3.  **Finance & Subscriptions:** Tracks total wealth across Bank, Savings, and Other. Includes a recurring Bills/Subscriptions tracker.
4.  **Trading 212 Integration:** Fetches portfolio and cash balances (Requires API key in Dev Panel).
5.  **YouTube Integration:** Fetches channel statistics, recent videos, and handles Google OAuth for advanced analytics (Requires API key & OAuth Client ID/Secret in Dev Panel).
6.  **Pomodoro Timer:** A 25/5 focus timer built into the Home Page with OS-level notifications on completion.
7.  **Sleep Tracker:** Calculates sleep duration, quality, consistency, and draws a 7-day bar chart.
8.  **Journal & Markdown:** Daily journal entries that parse standard Markdown (bold, italic, lists, headings) into HTML for past entries.
9.  **Auto-Updater:** Uses `electron-updater` to silently download new releases from GitHub and prompts the user with a banner to restart and install.

## Data Tagging System (For AI)
The AI responds with raw text, but uses invisible tags that `renderer.js` parses:
- `[SET_BALANCE:type:amount]`
- `[ADD_BALANCE:type:amount]`
- `[UPDATE_YT:type:amount]`
- `[SET_EXAM_DATE:date]`
- `[ADD_TODO:text]`
- `[ADD_HABIT:name]`
- `[COMPLETE_HABIT:name]`
- `[ADD_GOAL:text|category]`
- `[ADD_SHIFT:date:hours:wage]`
- `[ADD_TRIP:destination:date:budget]`
- `[SET_FOCUS:text]`
- `[LOG_SLEEP:bedtime:waketime]`
- `[NAVIGATE:sectionId]`

## Current State & UI Polish
- The codebase is highly modular.
- Staggered CSS animations exist for cards (`fadeUp`).
- The native window controls (Windows minimize/maximize/close) are accounted for via `140px` right-padding on the `main-topbar`.

## Next Potential Steps / Backlog
- **Data Export/Backup:** Add a button in Settings to download all local SychBoard `localStorage` data as a `.json` file.
- **Markdown expansion:** Apply the `parseMD()` function to Uni notes and Dev notes, not just the Journal.
- **Expense Proactivity:** Integrate the Bills/Subscriptions array into the AI's prompt so it can warn the user when a bill date is approaching.