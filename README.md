# 🚗 BiyahePro — Ride-Hailing Platform

Welcome to the central repository for **BiyahePro**, a ride-hailing platform with a customer mobile app, browser-based admin client, ASP.NET Core API, and PostgreSQL database.

## 🧰 Tech Stack

| Area | Technologies |
| --- | --- |
| Customer mobile | Expo SDK 57, React Native 0.86, React 19, TypeScript, Expo Router |
| Mobile capabilities | `react-native-maps`, `expo-location`, `expo-secure-store`, `@react-native-community/datetimepicker` |
| Admin web client | React 19, Vite 8, Tailwind CSS 4, Lucide React |
| Backend API | ASP.NET Core on .NET 10, C#, Dapper, JWT bearer authentication, BCrypt |
| Real-time communication | ASP.NET Core SignalR and `@microsoft/signalr` |
| Database | PostgreSQL, PostGIS, Npgsql, NetTopologySuite |
| Local infrastructure | Docker Compose |

## 📚 Overall Technology Stack

The complete BiyahePro stack, from client applications to infrastructure:

- **Languages:** C#, TypeScript, JavaScript, SQL
- **Customer mobile app:** Expo SDK 57, React Native 0.86, React 19, React DOM, React Native Web, Expo Router
- **Mobile libraries:** `react-native-maps`, `expo-location`, `expo-secure-store`, `expo-status-bar`, `@react-native-community/datetimepicker`
- **Admin web client:** React 19, React DOM, Vite 8, Tailwind CSS 4, `@tailwindcss/vite`, Lucide React
- **Web development tools:** Node.js, npm, ESLint, `@vitejs/plugin-react`, React Hooks and React Refresh ESLint plugins
- **Backend:** C#, ASP.NET Core Web API on .NET 10, REST endpoints, dependency injection, nullable reference types
- **Authentication and security:** JWT bearer authentication, BCrypt password hashing, secure mobile token storage
- **Real-time features:** ASP.NET Core SignalR, `@microsoft/signalr`
- **Data access:** Dapper, Npgsql, NetTopologySuite
- **Database:** PostgreSQL 18, PostGIS 3.6, UUIDv7 identifiers, spatial queries
- **Infrastructure:** Docker, Docker Compose, PostgreSQL persistent volumes, container health checks
- **Quality and configuration:** TypeScript compiler, ESLint, Vite production builds, environment variables, ASP.NET configuration

---

## 🛠️ Global Project Architecture Map

Ensure your folder tree layout side-by-side matches this complete schematic inside your root workspace:

```text
BiyahePro - new/                                    ← Root Workspace Directory
├── README.md                                      ← This file!
│
├── ridehailing-client/                            ← Phase 0: React Frontend Client
│   ├── index.html
│   ├── package.json
│   ├── eslint.config.js
│   ├── vite.config.js
│   ├── README.md
│   ├── lib/
│   │   └── api.js                                 ← API client integration layer
│   ├── public/
│   │   └── [Static assets]
│   └── src/
│       ├── main.jsx                               ← Application entry point
│       ├── App.jsx                                ← Root component
│       ├── App.css
│       ├── index.css
│       ├── assets/                                ← Images, icons, media
│       └── components/
│           └── admin/                             ← Admin dashboard UI
│               ├── AdminDashboard.jsx
│               ├── AuditLogs.jsx
│               ├── LiveTrips.jsx
│               ├── PinOverlay.jsx
|── ui/
|── StatusBadge.jsx
│
├── biyahepro-customer-mobile/                     ← Phase 0: Expo customer mobile app
│   ├── app/                                       ← Expo Router screens and layouts
│   │   ├── (auth)/                                ← Login and registration
│   │   ├── (tabs)/                                ← Home, bookings, and account
│   │   └── booking/                               ← New booking and driver matching
│   └── src/                                       ← API, auth session, types, and theme
│
├── biyahepro-driver-mobile/                       ← Phase 0: Expo driver mobile app
│   ├── app/                                       ← Driver auth and operational tabs
│   └── src/                                       ← API, auth session, types, and theme
│
├── ridehailing-db/                                ← Phase 1: PostgreSQL Database Scripts
│   ├── 00_extensions.sql                          ← PostGIS/UUID extensions
│   ├── 01_users.sql                               ← User accounts & authentication
│   ├── 02_drivers_vehicles.sql                    ← Driver & vehicle fleet tables
│   ├── 03_trips.sql                               ← Trip booking & tracking
│   ├── 04_payments_ratings.sql                    ← Transactions & ratings
│   ├── 05_app_settings.sql                        ← Global configuration cache
│   ├── 06_seed.sql                                ← Mock testing data
│   ├── 07_refresh_tokens.sql                      ← JWT token management
│   ├── 08_seed_admin.sql                          ← Admin account creation
│   └── 10_add_booking_fee.sql                     ← Booking fee column addition
│
└── RideHailing.API/                               ← Phase 2: ASP.NET Core Web API
    ├── Program.cs                                 ← Application entry & DI container
    ├── RideHailing.API.csproj                     ← Project configuration
    ├── appsettings.json                           ← Database & JWT config
    ├── bin/
    │   └── Debug/net10.0/                         ← Compiled output
    ├── obj/                                       ← Build artifacts
    ├── Controllers/                               ← API endpoints
    │   ├── AuthController.cs                      ← Login & registration
    │   ├── UsersController.cs                     ← User management
    │   ├── DriversController.cs                   ← Driver operations
    │   ├── TripsController.cs                     ← Trip booking & tracking
    │   └── SettingsController.cs                  ← Admin configuration
    ├── Hubs/
    │   └── RideHub.cs                             ← SignalR real-time WebSocket connections
    ├── Models/                                    ← Data transfer objects (DTOs)
    │   ├── User.cs
    │   ├── Driver.cs
    │   ├── Trip.cs
    │   └── AppSetting.cs
    ├── Middleware/
    │   ├── appsettings.json
    │   └── AuditMiddleware.cs                     ← Request/response audit logging
    ├── Repositories/                              ← Data access layer (Dapper ORM)
    │   ├── UserRepository.cs
    │   ├── DriverRepository.cs
    │   ├── DriverRepositoryAdditions.cs
    │   ├── TripRepository.cs
    │   └── SettingsRepository.cs
    └── Services/                                  ← Business logic layer
        ├── AuthService.cs                         ← Authentication & JWT generation
        ├── DriverService.cs                       ← Driver operations
        ├── TripService.cs                         ← Trip booking & dispatch
        ├── FareService.cs                         ← Dynamic fare calculation
        └── SettingsService.cs                     ← Configuration management
```

---

## 📱 Customer Mobile App (Expo)

`biyahepro-customer-mobile` is the customer-facing mobile application. It supports:

- Customer registration and login with secure native JWT session storage
- Home, booking history, and account tabs
- Map-based pickup and destination selection with current location
- Reverse-geocoded addresses and manual address editing
- Motorcycle or motorcab selection
- Cash, GCash, and card payment method selection
- Server-side fare estimates and booking confirmation
- Immediate and scheduled rides
- Searching-for-driver status polling and SignalR-ready trip updates

### 🏃 Start the customer app locally
1. Open a terminal in the mobile app folder:
   ```powershell
   cd "C:\Users\lague\Desktop\BiyahePro - new\biyahepro-customer-mobile"
   ```
2. Install dependencies and start Expo:
   ```powershell
   npm install
   npm start
   ```
3. Use Expo Go, an Android emulator, an iOS simulator, or the web option from the Expo developer menu.

For a physical device, create a `.env` file and point the app to the computer's LAN address:
```env
EXPO_PUBLIC_API_URL=http://192.168.1.20:5000
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_ANDROID_GOOGLE_MAPS_KEY
```

The API must be reachable from the device. On a physical phone, `localhost` refers to the phone rather than the development computer. Store/development builds may also require the appropriate Google Maps configuration.

Run the mobile TypeScript check with:
```powershell
npm run typecheck
```

---

## 🗄️ Phase 1: PostgreSQL & PostGIS Database Provisioning

This phase builds your relational database, adds location trackers, creates an isolated application user role, and inserts mock testing items.

### 🏃 Setup Commands
1. Open your terminal in VS Code (`Ctrl + ~`) and connect to your database system using the absolute path:
   ```powershell
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres
   ```
2. Paste and run these configuration scripts **one line at a time** inside the `postgres=#` interface:
   ```sql
   CREATE DATABASE ridehailing OWNER postgres;
   CREATE ROLE ridehailing_app WITH LOGIN PASSWORD 'Pisosabohol01';
   \c ridehailing
   ```
3. Load and compile all structure scripts in their correct file order to prevent cross-relationship breaks:
   ```sql
   \(\i 00_extensions.sql    \i 01_users.sql    \i 02_drivers_vehicles.sql    \i 03_trips.sql    \i 04_payments_ratings.sql    \i 05_app_settings.sql    \i 06_seed.sql    \i 07_refresh_tokens.sql    \i 08_seed_admin.\)sql
   ```
4. Verify your structural list displays **10 tables** by executing `\dt` (Press **Spacebar** to scroll, and **q** to close the viewer panel), then type `\q` to exit.
5. `08_seed_admin.sql` creates a real, login-able admin account — see **Admin Panel Access** below.
6. **Already had a database from before this fix?** Also run `\i 09_fix_vehicle_types.sql` — it corrects the `vehicles.vehicle_type` constraint from a placeholder `sedan/suv/van/motorcycle` set to BiyahePro's actual fleet (`motorcycle`, `motorcab`). Fresh installs get this automatically from `02_drivers_vehicles.sql` and can skip it.
7. **Already had a database from before this fix?** Also run `\i 10_add_booking_fee.sql` — adds the `trips.booking_fee` column and the `fare.booking_fee` setting (₱5 default) referenced in the BP's break-even analysis. Fresh installs get this automatically from `03_trips.sql` / `06_seed.sql` and can skip it.

---

## 🏗️ Phase 2: ASP.NET Core API Server Construction

This phase compiles your application logic controllers, caching components, data transfer structures, and real-time mapping hooks.

### 🏃 Setup Commands
1. Jump your current terminal path into the correct backend folder:
   ```powershell
   cd "C:\Users\lague\Desktop\BiyahePro - new\RideHailing.API"
   ```
2. Verify that your `appsettings.json` file contains your connection keys and JWT safety block parameters.
3. Clean out old temporary compilation traces and trigger a fresh build check:
   ```powershell
   dotnet clean
   dotnet build
   ```
4. Boot up your application web server engine:
   ```powershell
   dotnet run
   ```
The application will light up and display that it is actively listening for web traffic on: **`http://localhost:5000`**

---

## 🌐 Frontend Local Access (React + Vite)

This repo includes a local admin frontend in `ridehailing-client`. It is the browser entry point where the login screen appears and where admin users authenticate before accessing the dashboard.

### 🏃 Start the frontend locally
1. Open a new terminal in VS Code and go to the client folder:
   ```powershell
   cd "C:\Users\lague\Desktop\BiyahePro - new\ridehailing-client"
   ```
2. Install dependencies if needed:
   ```powershell
   npm install
   ```
3. Start the local development server:
   ```powershell
   npm run dev
   ```
4. Open the browser to the Vite local URL shown in the terminal, usually:
   ```text
   http://localhost:5173
   ```

### 🔐 Where the auth panel is
The login screen is the admin authentication panel rendered by the React client. It is driven by the files:
- `ridehailing-client/src/components/admin/LoginForm.jsx`
- `ridehailing-client/src/components/admin/AdminPage.jsx`
- `ridehailing-client/lib/api.js`

When the app loads, the browser shows the BiyahePro Admin sign-in form. After a successful login, the app saves the JWT in browser storage and loads the dashboard.

### 👤 Admin login credentials
Use the seeded admin account created by `ridehailing-db/08_seed_admin.sql`:
- Email: `admin@biyahepro.local`
- Password: `ChangeMe123!`

> These credentials are for local development only. Change the password before any real deployment.

### ⚠️ Back-end requirement
The frontend calls the API at:
```text
http://localhost:5000
```
So make sure the ASP.NET API is running first with:
```powershell
cd "C:\Users\lague\Desktop\BiyahePro - new\RideHailing.API"
dotnet run
```
If the API is not running, the login page may fail to authenticate even though the frontend loads properly.

---

## 🧠 Core Engineering Features to Remember

* **UUIDv7 Standard Identifiers:** Primary keys are generated as sequential, time-sortable strings. They double as an organic creation timestamp, which speeds up search sorting without extra table columns.
* **PostGIS Radius Math:** Vehicle locations utilize geographical coordinate vectors. The repository handles efficient, ultra-fast proximity checks to discover nearby vehicles using `ST_DWithin` algorithms.
* **60-Second Configuration Cache:** App rules, fares, and surge rates are loaded through an optimized memory cache. This shields your database from repetitive hits on everyday price requests.
* **Write Audit Middleware:** A pipeline intercept log captures and records any modifying changes made by system administrators into a secure audit table.

---

## 🔑 Admin Panel Access

`SettingsController` now requires `[Authorize(Roles = "admin")]` and reads the acting admin's id from the JWT (no more hardcoded mock GUID), so the admin panel needs a **real** login to do anything.

**Dev admin credentials** (created by `08_seed_admin.sql`):
* Email: `admin@biyahepro.local`
* Password: `ChangeMe123!`

Log in via `POST /api/auth/login` to get an access token, then send it as `Authorization: Bearer <token>` on `/api/settings` requests.

⚠️ **Change this password before any real deployment.** To reset it, edit the literal password in `08_seed_admin.sql` and re-run the file — `ON CONFLICT (email) DO UPDATE` overwrites the stored hash.

**Password policy (enforced on `POST /api/auth/register`):** minimum 8 characters, with at least one uppercase letter, one number, and one symbol. Enforced via a `RegularExpression` validation attribute on `RegisterRequest.Password` (`Models/User.cs`) — `[ApiController]` validates it automatically and returns `400` with a clear message if it fails. This is a create-time check only; there's no password-reset endpoint yet.

> **Legacy note:** the React admin client (`ridehailing-client`) previously used a hardcoded 4-digit PIN screen (`PinOverlay.jsx`, PIN `1234`) that wasn't wired to any real auth. That PIN gate is deprecated — the client should call `/api/auth/login` and store the returned JWT instead.

---

## 🚨 Troubleshooting & Fix Reference Guide

### 1. "The term 'psql' is not recognized"
* **Cause:** Windows doesn't know where the PostgreSQL tool is hiding.
* **Fix:** Bypass global shortcuts by running commands through its explicit computer path: `& "C:\Program Files\PostgreSQL\18\bin\psql.exe"`.

### 2. "Did not find any tables"
* **Cause:** Running scripts while they still have a solid white circle (⚪) in your editor. This tells the database to read empty files from your drive.
* **Fix:** Always force-save all components (`Ctrl + K, S`) before deploying migrations.

### 3. Namespace Mismatch Errors (`CS0234` / `CS0246`)
* **Cause:** Files cannot see their neighbors because their header definitions are broken or sitting in incorrect directories.
* **Fix:** Ensure files start with an explicit layout name mapping line (e.g., `namespace RideHailing.API.Services;`) and verify folders use the plural names matching your architecture tree.

### 4. Code Changes Not Updating
* **Cause:** The compiler gets stuck reading an outdated system memory cache.
* **Fix:** Wipe out the old memory folders and trigger a clean build process:
  ```powershell
  Remove-Item -Path .\bin\,.\obj\ -Recurse -Force
  dotnet clean
  dotnet build
  ```