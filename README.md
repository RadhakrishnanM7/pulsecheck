# PulseCheck v2 — live multi-device quizzes

Now with real join links: students open a link (or scan a QR / type a room code)
on their own phones, appear live on your screen, and their answers stream in.

This works by adding one free piece — a **Firebase (Cloud Firestore)** database
that all the devices sync through. Your site still lives on GitHub Pages; Firebase
is just the shared "meeting point." Setup is a one-time ~10 minutes.

---

## Part 1 — Connect Firebase (do this once)

1. Go to **https://console.firebase.google.com** and sign in with your Google account.
2. Click **Add project** (or **Create a project**). Give it a name like `pulsecheck`.
   You can turn **off** Google Analytics to keep it simple. Click **Create project**.
3. On the project dashboard, click the **web icon `</>`** ("Add app to get started").
   Give it a nickname (e.g. `pulsecheck-web`) and click **Register app**.
   - You'll see a block of code containing `const firebaseConfig = { ... }`.
   - **Copy those values** (apiKey, authDomain, projectId, etc.). Keep them handy.
   - You can skip the remaining "Add SDK" steps and click **Continue to console**.
4. In the left menu, open **Build → Firestore Database** and click **Create database**.
   - Choose a location near you, click **Next**.
   - Pick **Start in test mode** for now, then **Enable**. (We'll set permanent rules next.)
5. Set the access rules so the app keeps working after 30 days. In Firestore, open the
   **Rules** tab, replace everything with the text below, and click **Publish**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /rooms/{room}/{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```

   > Note: these rules are open — anyone who has a room code can read/write that room.
   > That's fine for short-lived classroom quizzes. For stronger control you can add
   > Firebase Authentication later.

6. Open **`src/firebaseConfig.js`** and replace each `PASTE_...` value with the matching
   value you copied in step 3. Save.

That's it. When those values are real, the app switches on live join links automatically.

---

## Part 2 — Run / deploy (same as before)

Local:
```bash
npm install
npm run dev        # http://localhost:5173
```

Deploy: this repo already builds itself on GitHub via `.github/workflows/deploy.yml`.
Just commit your changes (including the filled-in `firebaseConfig.js`) and push — the
Action rebuilds and your GitHub Pages link updates in about a minute.

---

## How students join

On the teacher **Present** tab, click **Create room & get join link**. You'll get:

- a **room code** (e.g. `4KQP`),
- a **join link** to copy/paste into WhatsApp or email,
- a **QR code** students can scan.

All three point to the same place: `https://<your-site>/#join-<CODE>`. Students land on a
name + animal screen, then wait until you press **Start quiz**. As they join, their avatars
appear (and dance) on your screen; as they answer, the correct/incorrect histogram updates live.

---

## Free-tier capacity (Firestore Spark plan)

Free quota is **50,000 reads + 20,000 writes per day**, with no cap on how many students
connect at once (unlike Realtime Database, which is limited to 100). A typical 100-student,
10-question session uses only a few thousand reads/writes, so the free tier comfortably covers
roughly **ten 100-student sessions per day**. Heavier use just needs the pay-as-you-go Blaze
plan (a classroom quiz costs a few cents).

- **Hotspot images:** each question is stored as one Firestore document (1 MiB max), so keep
  hotspot images reasonably small.
- **Data** for a room lives under `rooms/<CODE>` in Firestore; you can delete old rooms from
  the Firebase console anytime.
