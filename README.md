# Inventory Management System

A server-rendered inventory app built with **Node.js, Express, EJS, MongoDB (Mongoose)**, Bootstrap 5 and Chart.js.
It manages products, categories, suppliers, stock in/out, low-stock alerts, reports, users and an activity log.

## Quick start (MongoDB Atlas, no local MongoDB needed)

```
npm install
npm run dev
```

Then open **http://localhost:3000** and log in (see `LOGIN_DETAILS.md`). `npm run dev` first checks your `.env`, connects to MongoDB Atlas, creates the `admin` account if it does not exist yet, and then starts the server with auto-restart. If anything is wrong (missing `.env`, bad Atlas password, IP not allowed) it stops and prints what to fix.

## Contents

1. [What you need](#1-what-you-need-install-these-first)
2. [Extract and open in VS Code](#2-extract-the-zip-and-open-it-in-vs-code)
3. [Install dependencies](#3-install-the-dependencies)
4. [MongoDB Atlas setup](#4-mongodb-atlas-setup)
5. [Create the `.env` file](#5-create-the-env-file)
6. [Create the first administrator](#6-create-the-first-administrator)
7. [Load sample data](#7-load-sample-data-optional)
8. [Start the app](#8-start-the-application)
9. [Test each feature](#9-test-each-major-feature)
10. [Roles and permissions](#10-roles-and-permissions)
11. [Automated tests](#11-automated-tests)
12. [Project structure](#12-project-structure)
13. [Security features](#13-security-features-good-to-explain-to-your-teacher)
14. [Troubleshooting](#14-troubleshooting)
15. [Known limitations](#15-known-limitations)

---

## 1. What you need (install these first)

| Software | Version | Where |
|---|---|---|
| Node.js (LTS) | 18, 20 or 22 | https://nodejs.org (installer includes npm) |
| Visual Studio Code | any recent | https://code.visualstudio.com |
| MongoDB | Local Community Server **or** a free Atlas cluster | see [step 4](#4-set-up-mongodb) |
| A web browser | Chrome, Edge or Firefox | |

An internet connection is needed when you open the app, because Bootstrap and Chart.js are loaded from the jsDelivr CDN.

Check Node is installed (VS Code: **Terminal > New Terminal**):

```
node -v
npm -v
```

## 2. Extract the ZIP and open it in VS Code

1. Right-click `inventory-management-system.zip` and choose **Extract All...**
2. Open VS Code, choose **File > Open Folder...** and select the extracted `inventory-management` folder (the one that contains `package.json`).
3. Open the terminal inside VS Code: **Terminal > New Terminal**. All commands below are run there.

If PowerShell refuses to run `npm` ("running scripts is disabled"), run this once and reopen the terminal:

```
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Or switch the terminal to **Command Prompt** using the dropdown next to the **+** button.

## 3. Install the dependencies

```
npm install
```

This creates the `node_modules` folder and a `package-lock.json` file. (The ZIP does not include `node_modules`.)

## 4. MongoDB Atlas setup

This project uses **MongoDB Atlas**; you do not install MongoDB locally. In Atlas:

1. **Database Access**: you need a database user with *Read and write to any database* (or at least on `inventory_management`). Note its username and password.
2. **Network Access**: add the IP address you run the app from (**Add Current IP Address**). For quick testing you can use `0.0.0.0/0`. A changed IP (new Wi-Fi, VPN) is the most common reason for connection errors.
3. **Database > Connect > Drivers**: copy the connection string.
4. In the string, replace the placeholders with your real user and password and **remove the `< >` brackets**. URL-encode special characters in the password (`@` is `%40`, `#` is `%23`, `/` is `%2F`).
5. Make sure `/inventory_management` appears right before the `?` (database name). If it is missing the app still uses `inventory_management` (via `MONGODB_DB`), never `test`.

The app has no localhost fallback. If `MONGODB_URI` is missing, still has `<placeholders>`, or Atlas cannot be reached, startup stops with a clear message. Credentials are masked in all error output.

## 5. Create the `.env` file

```
copy .env.example .env
```

Fill in `MONGODB_URI`, `SESSION_SECRET` (generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) and `ADMIN_PASSWORD` (in single quotes). `.env` is excluded by `.gitignore`; never upload or share it.

## 6. Create (or reset) the administrator

There is **no password hard-coded in the app**. `npm run dev` / `npm start` automatically run `scripts/ensureAdmin.js`, which creates the admin from the `ADMIN_*` values in `.env` **only if it does not exist yet** (an existing account is never modified). Passwords are hashed with bcrypt (12 rounds); only the hash is stored.

To deliberately reset the admin password later, use the command below.

Manual create / reset:

```
npm run create-admin
```

Username, name and email are taken from `.env`; you are only asked for the **password** (typed characters are hidden). Passwords need at least 8 characters with a letter and a number.

What the command does:

- Username not found: a new admin is created.
- Username already exists: the **same account** is updated (new password hash, role set to admin, account re-activated). No duplicate is ever created, so it is also the safe way to reset the admin password.
- Email belongs to a different account: it stops and changes nothing.
- It never prints the password.

Alternative without prompts: put the password in `.env` **inside single quotes** (important: `#` and `$` are special characters in `.env` files, and without quotes the password is cut off):

```
ADMIN_PASSWORD='your-password-here'
```

Run `npm run create-admin`, then **delete the `ADMIN_PASSWORD` line from `.env`**.

Other helpers (nothing is ever deleted by these):

```
npm run list-users
npm run reset-password
npm run reset-password -- yourusername --generate
```

`list-users` shows usernames, roles and whether each account is active (never password hashes). `reset-password` sets a new password for any existing account; `--generate` makes a random one and prints it once; add `--activate` to re-enable a deactivated account. Create further users from the **Users** page.

## 7. Load sample data (optional)

```
npm run seed
```

Adds fictional categories, suppliers, 12 products (some deliberately low or out of stock) and sample stock history. Run step 6 first so the history can be attributed to your admin. Safe to run again: existing SKUs are skipped.

To wipe products, categories, suppliers and stock history and start the sample data fresh (users are kept):

```
npm run seed:reset
```

## 8. Start the application

Development (restarts automatically when you edit files):

```
npm run dev
```

Production-style:

```
npm start
```

Open **http://localhost:3000/login** in your browser and log in with the admin you created. After login you land on the dashboard at **http://localhost:3000/** (if you tried to open another protected page first, you are returned to that page). Stop the server with `Ctrl + C`.

If port 3000 is busy, set `PORT=3001` in `.env`.

## 9. Test each major feature

Log in as the admin and work through this list.

| Feature | How to try it |
|---|---|
| Login errors | Enter a wrong password: you get "Invalid username or password." Ten failed tries from one computer locks login for 15 minutes. |
| Dashboard | Totals, two charts, low-stock list, recent transactions and activity. All numbers come from MongoDB. |
| Categories | **Categories > Add category**. Search, edit, delete. Deleting a category that has products is blocked with a message. |
| Suppliers | Same flow as categories. Try an invalid phone number or email to see validation. |
| Products | **Products > Add product**. Upload a JPG/PNG. Try a duplicate SKU, a negative price, or a 5 MB image: each is rejected with a message. Search by name or SKU, and filter by category and supplier. |
| Stock In | **Stock In**, choose a product, enter a quantity. Product quantity rises and a transaction row appears. |
| Stock Out | **Stock Out** more than is available: rejected, stock never goes below zero. A valid quantity lowers stock. If it reaches the minimum, a warning appears. |
| Transaction history | Filter by type, product/SKU and date range. Each row shows previous and new stock, the user and the note. |
| Low stock | The sidebar badge, dashboard tile and **Low stock** page all list products at or below their minimum. Highlighted rows in tables are amber (low) or red (out). |
| Reports | **Reports**: pick a report, optionally dates, then **Download CSV**. Open the CSV in Excel. |
| Users (admin) | **Users > Add staff account**. Edit a user, change role, deactivate/activate. Try to deactivate the only admin: blocked. |
| Password reset (admin) | **Users > Reset password** shows a one-time link valid for 1 hour. Open it in a private window and set a new password. The link stops working after use. |
| Account settings | Update your name/email and change your own password (current password required). |
| Activity log (admin) | **Activity log** lists logins, stock changes, edits and exports with user and time. |
| Staff restrictions | Log in as a staff user and open `/users` in the address bar: you get the **Access denied** page. |
| Error pages | Open `/does-not-exist` for the 404 page. |

## 10. Roles and permissions

| Action | Staff | Admin |
|---|:---:|:---:|
| View dashboard, products, categories, suppliers, history, reports | Yes | Yes |
| Add and edit products, Stock In / Stock Out | Yes | Yes |
| Add categories and suppliers | Yes | Yes |
| Edit or delete categories and suppliers | No | Yes |
| Delete products | No | Yes |
| User management, password reset links, activity log | No | Yes |
| Edit own profile and password | Yes | Yes |

Self-registration (if enabled) only ever creates Staff accounts. Roles are checked on the server for every request, so hiding a link is never the only protection.

## 11. Automated tests

```
npm test
```

Uses Node's built-in test runner (no extra packages). The tests cover the business rules that do not need a database: stock in/out maths and negative-stock prevention, low-stock detection, inventory valuation, input validation (prices, quantities, SKU, passwords, emails), CSV escaping and formula-injection protection, CSRF token comparison, date ranges, image content checks, the "last active admin" rule and pagination.

Database behaviour (CRUD, transactions, sessions) is **not** covered by automated tests. Test it with the checklist in step 9.

## 12. Project structure

```
inventory-management/
├── app.js                 Express setup (security headers, sessions, CSRF, routes)
├── config/                env.js (settings), db.js (MongoDB connection)
├── models/                User, Product, Category, Supplier, StockTransaction, ActivityLog
├── routes/index.js        All URLs and which role may use them
├── controllers/           One file per feature (request handling)
├── services/              stockRules (pure rules), stockService (DB updates),
│                          reportService, dashboardService, userRules
├── middleware/            auth, csrf, flash, upload, errors
├── utils/                 validators, csv, csrf, dates, pagination, image check, activity logging
├── views/                 EJS templates: layouts/, partials/, one folder per feature
├── public/                css/style.css, js/main.js, images/, uploads/ (product photos)
├── scripts/               createAdmin.js, seed.js
├── tests/                 Automated tests
├── .env.example           Settings template (copy to .env)
└── package.json
```

How stock changes stay consistent: `services/stockService.js` changes the quantity and writes the transaction record together. If your MongoDB supports transactions (Atlas, or a local replica set) it uses a real database transaction. A plain local MongoDB does not support them, so the code falls back to an atomic conditional update (stock out only succeeds if enough stock remains) and undoes the change if the history record cannot be saved.

## 13. Security features (good to explain to your teacher)

- Passwords hashed with bcrypt (12 rounds); hashes never shown or logged.
- Session login stored in MongoDB; session id regenerated at login; cookie is HttpOnly and SameSite=Lax.
- CSRF token required on every POST. No GET request changes data (delete, logout and toggles are all POST).
- Login rate limiting; the same error message for unknown user and wrong password.
- Server-side validation on every form; NoSQL operator injection is blocked because only plain strings are accepted and IDs are checked.
- Security headers and a Content-Security-Policy via Helmet; no inline scripts.
- Uploads: 2 MB limit, only JPG/PNG/WEBP/GIF, the real file type is checked from the file contents, files are saved with random names.
- All output is HTML-escaped by EJS.
- CSV export neutralises cells that start with `=`, `+`, `-`, `@`.
- Secrets live in `.env`, which is excluded by `.gitignore`.

## 14. Troubleshooting

| Problem | Fix |
|---|---|
| `SESSION_SECRET is missing or too weak` | You skipped step 5. Create `.env` and set `SESSION_SECRET`. |
| `MONGODB_URI is missing` / `still contains a placeholder` | Fix `.env` as described in step 4/5. |
| `Could not connect to any servers in your MongoDB Atlas cluster` | Atlas **Network Access** does not allow your current IP. Add it and retry. |
| `bad auth` / `Authentication failed` (Atlas) | Wrong username or password in `MONGODB_URI`. Encode special characters in the password (for example `@` becomes `%40`). |
| Atlas: `Server selection timed out` | Your IP is not allowed. Add it under **Network Access** in Atlas. |
| `npm install` fails on `bcrypt` | Install the current Node.js **LTS** version, delete the `node_modules` folder, and run `npm install` again. If it still fails, install "Desktop development with C++" from Visual Studio Build Tools. |
| Login says "Invalid username or password." | Run `npm run list-users` to see which accounts exist in the database your `MONGODB_URI` points to, then `npm run create-admin` to reset. Make sure the password in `.env` (if used) is in single quotes. |
| `npm : File ...npm.ps1 cannot be loaded` | See the PowerShell policy command in step 2, or use Command Prompt. |
| `EADDRINUSE: address already in use :::3000` | Another program uses port 3000. Set `PORT=3001` in `.env`. |
| Page looks unstyled and charts are empty | Bootstrap and Chart.js come from a CDN: check your internet connection or any firewall. |
| "Invalid or missing security token" | The form was open too long or cookies are blocked. Reload the page and try again. |
| "Too many failed attempts" | Wait 15 minutes, or stop and restart the server. |
| Cannot log in after setting `COOKIE_SECURE=true` | Secure cookies need HTTPS. Set it back to `false` for `http://localhost`. |
| `E11000 duplicate key` in the terminal | You tried to create a record with a name, SKU, username or email that already exists. |
| Want to start over | `npm run seed:reset` clears inventory data. To remove everything, drop the `inventory_management` database in MongoDB Compass or Atlas. |

## 15. Known limitations

- Reports are shown on one page (no pagination); transaction reports are limited to the newest 5,000 rows.
- Password reset has no email sending: an administrator creates a link and passes it to the user.
- Product images are stored on the server's disk (`public/uploads`), not in cloud storage.
- Login rate limiting is kept in memory, so it resets when the server restarts.
- One currency symbol (₹) is used in the display.
