# 🧶 Chino Yarn Studio

A personal yarn inventory and crochet project tracker — built as an Android APK using Capacitor, with Supabase as the sync backend. Works fully offline and syncs to the cloud when connected.

**Built for solo use** — one person, one phone, one stash.

---

## ✨ Features

- 📦 Track your yarn stash by brand, yarn type, and colourway
- 🪡 Log crochet projects and track yarn usage per project
- 📊 Dashboard with stash stats — total skeins, meters, grams, stash value, most stocked yarn, and more
- ☁️ Sync to Supabase — push your data to the cloud and restore it on a fresh install
- 🔒 PIN lock for privacy
- 📴 Fully offline-first using IndexedDB

---

## 🛠️ Setup Guide

### What you'll need
- [Node.js](https://nodejs.org) (v18 or higher)
- [Android Studio](https://developer.android.com/studio) with Android SDK
- Java JDK 17+
- A free [Supabase](https://supabase.com) account

---

### Step 1 — Clone the repo

```bash
git clone https://github.com/YOURUSERNAME/chino-yarn-studio.git
cd chino-yarn-studio
npm install
```

---

### Step 2 — Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project**
   - Name: anything you like (e.g. `my-yarn-studio`)
   - Region: pick the one closest to you
   - Set a database password and save it somewhere
3. Wait ~2 minutes for the project to spin up
4. Go to **SQL Editor** → **New query** and paste this entire SQL, then click **Run**:

```sql
create table brands (
  id serial primary key,
  name text not null,
  country text
);

create table yarns (
  id serial primary key,
  "brandId" integer references brands(id),
  name text not null,
  fiber text,
  weight integer,
  "metersPerSkein" numeric(8,2),
  "gramsPerSkein" numeric(8,2)
);

create table colourways (
  id serial primary key,
  "yarnId" integer references yarns(id),
  "colourName" text not null,
  "lotNumber" text
);

create table inventory (
  id serial primary key,
  "colourwayId" integer references colourways(id),
  qty numeric(8,2) not null,
  "locationBin" integer,
  "purchasedDate" date,
  "costPerSkein" numeric(10,2)
);

create table projects (
  id serial primary key,
  name text not null,
  status text not null,
  "dateStarted" date,
  "dateEnded" date,
  notes text
);

create table usage (
  id serial primary key,
  "projectId" integer references projects(id),
  "inventoryId" integer references inventory(id),
  "skeinsUsed" numeric(8,2),
  "metersUsed" numeric(10,2),
  "gramsUsed" numeric(10,2)
);
```

5. Open a **New query** tab and run this to disable Row Level Security:

```sql
alter table brands     disable row level security;
alter table yarns      disable row level security;
alter table colourways disable row level security;
alter table inventory  disable row level security;
alter table projects   disable row level security;
alter table usage      disable row level security;
```

6. Go to **Project Settings → API** and copy:
   - **Project URL** — looks like `https://xxxxxxxxxxxxxx.supabase.co`
   - **anon public** key — long JWT string

---

### Step 3 — Add your Supabase credentials

Open `www/app.js` and replace the placeholders at the top of the file:

```javascript
const SUPABASE_URL  = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_KEY  = 'YOUR_SUPABASE_ANON_KEY';
```

With your actual values:

```javascript
const SUPABASE_URL  = 'https://xxxxxxxxxxxxxx.supabase.co';
const SUPABASE_KEY  = 'eyJhbGci...your full anon key here...';
```

> ⚠️ **Important:** If you fork this repo, make sure you do **not** commit your real credentials. Add `www/app.js` to `.gitignore` or use environment variables if you plan to keep the repo public.

---

### Step 4 — Build the APK

```bash
npx cap sync
npx cap open android
```

In Android Studio:
1. Wait for Gradle to finish syncing
2. Go to **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. Once done, click **locate** to find the APK file
4. Transfer to your Android phone and install

> Make sure **Install from unknown sources** is enabled on your phone for your file manager app.

---

### Step 5 — First launch

1. Open the app and set your 4-digit PIN
2. Start adding your yarn stash in the **Manage** tab
3. Tap the ☁️ button to sync to Supabase
4. If you ever clear app data or reinstall — just tap ☁️ and your data will be restored from Supabase

---

## 📁 Project Structure

```
www/
├── index.html        # App shell, styles, overlays
└── app.js            # All app logic + sync engine
capacitor.config.json # Capacitor configuration
android/              # Generated Android project
```

---

## 🔧 Capacitor Config

```json
{
  "appId": "com.chino.yarnstudio",
  "appName": "Chino Yarn Studio",
  "webDir": "www",
  "android": { "allowMixedContent": true },
  "plugins": {
    "CapacitorHttp": { "enabled": true },
    "SplashScreen": { "launchShowDuration": 0 }
  }
}
```

---

## 🧰 Tech Stack

| Layer | Tech |
|---|---|
| App shell | HTML + vanilla JS |
| Local storage | IndexedDB |
| Native wrapper | Capacitor 6 |
| Cloud sync | Supabase (Postgres + REST API) |
| Build output | Android APK |

---

## 💜 Made with love by Kiah

Built for personal use as a solo crochet stash tracker. Feel free to fork it and make it your own!
