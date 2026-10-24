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

### 2. Comprehensive Settlement Tracking
- **Settlement Statuses**: Supports `Paid`, `Pending`, and `Delayed` statuses.
- **Strict Balance Integrity**: Only confirmed `Paid` settlements reduce outstanding debts. `Pending` and `Delayed` statuses preserve balances until marked paid.
- **Payment Notes**: Record payment references (e.g. UPI Ref ID, transaction IDs, or cash notes).
- **Timestamps**: All settlements and expenses track exact timestamps with date & time display.
- **Duplicate Prevention**: Backend rate-limiting guards against rapid double-clicks within 5 seconds, and UI buttons lock into a loading state during submission.

### 3. Dashboard & Analytics
- **Total Group Spending**: Live counter of all group expenditures.
- **Top Contributor ("Who paid the most")**: Displays the member who spent the highest total.
- **Personal Financial Summary**: Personalized card for the logged-in user showing total paid, total share owed, and net balance position.
- **Spending by Category**: Breakdown with visual progress bars across categories.
- **Monthly Spending Overview**: Monthly distribution chart visualizing spending over time.

### 4. Expense Categorization & Activity Filtering
- **7 Predefined Categories**: Food (🍔), Travel (✈️), Rent (🏠), Shopping (🛍️), Entertainment (🎬), Utilities (💡), and Other (📦).
- **Notes & Receipts**: Add optional store notes, bill numbers, or receipt references to any expense.
- **Multi-Factor Filtering**: Instantly filter group activity by:
  - Activity Type / Status (All, Expenses, Settlements, Paid, Pending, Delayed)
  - Category (Food, Travel, etc.)
  - Member (Filter by person)

### 5. Exportable Reports
- **CSV Download**: One-click export of complete group activity (dates, types, descriptions, categories, amounts, participants, statuses, and notes) with UTF-8 BOM encoding.
- **Printable Settlement Summary**: Dedicated print view (`@media print`) that formats an invoice-style settlement report for trips, roommates, or event planning.

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


