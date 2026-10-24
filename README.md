# SplitFair — Smart Group Expense & Settlement Platform

SplitFair is a full-stack group expense splitting and debt-simplification platform. Create groups, share 6-character invite codes, log expenses with category tags and receipts, visualize spending analytics, and settle balances in the fewest possible payments.

Built with **React 19 + Express.js + MongoDB Atlas**, hosted on **Render**.

---

## 📌 Submission & Project Links

| Resource | Link |
| :--- | :--- |
| **GitHub Repository** | [https://github.com/vedansh023/End-term-MERN-Project](https://github.com/vedansh023/End-term-MERN-Project) |
| **Live Deployed App** | *Hosted on Render Web Service (linked to `main` branch)* |
| **Health Check Endpoint** | `/api/health` |

---

## 🚀 Key Features

### 1. Smart Debt Simplification & Currency Engine
- **Exact Paise Precision**: Amounts are stored internally as integer paise (1 INR = 100 paise) to eliminate floating-point rounding errors across custom and equal splits.
- **Greedy Debt Solver**: Graph algorithm that matches maximum debtors with maximum creditors to settle all balances in the minimum theoretical number of transfers.

### 2. Multi-Payer Expenses & Flexible Split Modes
- **Multiple Payers**: Support for expenses funded by multiple people simultaneously with automatic balance crediting.
- **4 Flexible Split Modes**:
  - **Equal Split**: Even division among selected members with remainder paise distributed cleanly.
  - **Custom Amounts (₹)**: Specific rupee amounts per member.
  - **Percentages (%)**: Exact percentage allocations totaling 100%.
  - **Shares / Weights**: Ratio allocations (e.g., 2 shares for a couple, 1 share for solo traveler).

### 3. Settlement Tracking & Gentle "Nudge" Reminders
- **Settlement Statuses**: Supports `Paid`, `Pending`, and `Delayed` statuses. Only confirmed `Paid` settlements reduce outstanding debts.
- **Payment Notes**: Record payment references (e.g. UPI Ref ID, transaction IDs, or cash notes).
- **Friendly Nudge Reminders**: One-click reminder button for awaiting payments that copies a polite settlement reminder to the clipboard.
- **Duplicate Prevention**: Backend rate-limiting guards against rapid double-clicks within 5 seconds.

### 4. Group Trip Budgeting & Analytics
- **Live Spending Counter**: Total group expenditures and who paid the most.
- **Trip Budget Cap & Progress Meter**: Set target trip budgets (₹) with real-time progress bar alerts (Green `<75%`, Amber `75-99%`, Red `Over Budget`).
- **Personal Financial Summary**: Personalized card for the logged-in user showing total paid, total share owed, and net balance position.
- **Spending by Category & Monthly Trends**: Category breakdown with progress bars and monthly chart.

### 5. Expense Management & Activity Filtering
- **Edit & Delete Expenses**: In-place editing and deletion of logged expenses with instant ledger recalculations.
- **7 Predefined Categories**: Food (🍔), Travel (✈️), Rent (🏠), Shopping (🛍️), Entertainment (🎬), Utilities (💡), and Other (📦) with receipt notes.
- **Multi-Factor Filtering**: Instantly filter group activity by type/status, category, or group member.

### 6. Archive Groups & Exportable Reports
- **Archive / Restore Groups**: Close settled groups to freeze balances and clean up active dashboards.
- **CSV Download**: One-click export of complete group activity with UTF-8 BOM encoding.
- **Printable Settlement Summary**: Dedicated print view (`@media print`) that formats an invoice-style settlement report.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, React Router v7, Vite 8, Pure CSS (custom typography & responsive design)
- **Backend**: Node.js, Express 4, Cookie-Parser, CORS, JSONWebToken, Bcrypt
- **Database**: MongoDB Atlas via Mongoose 8
- **Containerization & Deployment**: Docker (multi-stage build), Render Web Services

---

## 🔒 Security & Credential Hygiene

- **No Secrets Exposed**: All sensitive credentials (`MONGO_URI`, `JWT_SECRET`) are loaded exclusively from environment variables on Render. No secrets or connection strings are committed to source control.
- **HttpOnly Cookies**: Session tokens are signed using JWT and delivered via `HttpOnly`, `SameSite=Lax` cookies (`secure=true` in production), preventing XSS token theft.
- **Password Hashing**: User passwords are encrypted using `bcrypt` (10 salt rounds). Passwords are excluded from database queries (`.select("-password")`).

---

## 🏃 Run Locally

### Prerequisites
- Node.js 20+
- MongoDB running locally (`mongodb://127.0.0.1:27017`) or Docker

### 1. Clone & Install Dependencies
```powershell
git clone https://github.com/vedansh023/End-term-MERN-Project.git
cd End-term-MERN-Project
npm install
npm run install:all
```

### 2. Configure Environment Variables
Copy `server/.env.example` to `server/.env`:
```ini
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/splitfair
JWT_SECRET=replace_with_a_long_random_secret
CLIENT_ORIGIN=http://localhost:5173
```

### 3. Start Development Servers
```powershell
npm run dev
```
- Web Application: `http://localhost:5173`
- Backend API: `http://localhost:5000`

---

## 🐳 Docker & Cloud Deployment (Render)

SplitFair includes a production-ready multi-stage `Dockerfile`:

```dockerfile
# Stage 1: Build frontend bundle
FROM node:22-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Serve API & Client bundle from Express
FROM node:22-bookworm-slim AS production
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=client-build /app/client/dist ./public
EXPOSE 5000
CMD ["node", "index.js"]
```

### Deploying on Render:
1. Connect this GitHub repository to Render as a **Web Service**.
2. Set Environment Variables in the Render dashboard:
   - `MONGO_URI`: Your MongoDB Atlas connection URI (`mongodb+srv://...`)
   - `JWT_SECRET`: A secure, random secret key
   - `NODE_ENV`: `production`
   - `CLIENT_ORIGIN`: Your Render deployment URL (`https://<service-name>.onrender.com`)
3. Render automatically runs the build and starts the application listening on the dynamic `PORT`.


