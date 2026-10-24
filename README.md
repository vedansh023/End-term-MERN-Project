# SplitFair

Group expenses without a group-chat spreadsheet. Create a group, share an invite code, log who paid, and settle in the fewest transfers.

No AI APIs. If MongoDB and this app are running, the demo works.

## Stack

- React (Vite) + Express + MongoDB
- Amounts stored as paise (integers) so balances stay exact
- Cookie auth (JWT, HttpOnly)

## Run locally

**1. Start MongoDB** (pick one)

- Docker: `docker compose up -d`
- Or local MongoDB on `mongodb://127.0.0.1:27017`
- Or MongoDB Atlas: put the connection string in `server/.env` as `MONGO_URI`

**2. Install and start**

```powershell
cd C:\Users\vedan\SplitFair
npm install
npm run install:all
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:5000

**3. Demo flow**

1. Register two accounts (two browsers, or a normal window + a private window).
2. Create a group in one account, copy the invite code.
3. Join with that code in the second account.
4. Add an expense (dinner, cab) split equally.
5. Open **Settle in the fewest payments** and click **Mark paid**.

## What it does

- Register / login / logout
- Create group or join with a 6-character code
- Add expense: who paid, amount in ₹, and either equal or custom member shares
- Balance cards + simplified settle-up suggestions
- Payer-controlled payment popup to mark a suggested payment as paid or delayed
- Activity history of expenses, paid settlements, and delayed payments

## Deploy with Docker

The production container serves the React app and API from the same domain, so no frontend API URL needs to be configured.

1. Create a MongoDB Atlas database and copy its connection string.
2. Copy `server/.env.example` to `server/.env` and set a strong, unique `JWT_SECRET` and your Atlas `MONGO_URI`.
3. Build and run the production image:

```powershell
docker build -t splitfair .
docker run --rm -p 5000:5000 --env-file server/.env -e NODE_ENV=production -e CLIENT_ORIGIN=http://localhost:5000 splitfair
```

Open `http://localhost:5000`. The health check is available at `/api/health`.

For a public host that supports Docker (such as Render, Railway, or Fly.io), deploy this repository using the `Dockerfile` and add these environment variables in the host dashboard:

- `MONGO_URI`: your MongoDB Atlas connection string
- `JWT_SECRET`: a long random secret
- `NODE_ENV`: `production`
- `CLIENT_ORIGIN`: your final HTTPS app URL, for example `https://splitfair.example.com`

Do not commit the `.env` file or expose its values in the client.
