# 🌿 Oh Hey There — Command Center
## Deployment Guide for Alex & CJ

---

## STEP 1 — Set Up Supabase (5 mins)

1. Go to https://supabase.com and sign in
2. Click **"New Project"**
   - Name: `oht-command-center`
   - Database password: choose something strong, save it
   - Region: **Southeast Asia (Singapore)**
3. Wait ~2 mins for it to provision
4. Go to **Settings → API**
5. Copy these two values — you'll need them:
   - **Project URL** (looks like: `https://xxxx.supabase.co`)
   - **anon public key** (long string starting with `eyJ...`)

---

## STEP 2 — Create Admin Accounts in Supabase (3 mins)

1. In your Supabase project, go to **Authentication → Users**
2. Click **"Add User"** → **"Create New User"**
3. Create Alex's account:
   - Email: `alex@ohheythere.cafe` (or your real email)
   - Password: choose a strong password
4. Create CJ's account:
   - Email: `cj@ohheythere.cafe` (or CJ's real email)
   - Password: choose a strong password
5. Done — these are the only two login accounts

---

## STEP 3 — Deploy to Vercel (5 mins)

### 3a. Upload code to GitHub
1. Go to https://github.com/new
2. Create a new **private** repository called `oht-command-center`
3. Upload all files from this folder to that repo
   (drag and drop the folder contents into GitHub)

### 3b. Deploy on Vercel
1. Go to https://vercel.com
2. Click **"Add New Project"**
3. Import your `oht-command-center` GitHub repo
4. Vercel will auto-detect Next.js — don't change any settings
5. Before clicking Deploy, add **Environment Variables**:
   - Click **"Environment Variables"**
   - Add: `NEXT_PUBLIC_SUPABASE_URL` → paste your Supabase Project URL
   - Add: `NEXT_PUBLIC_SUPABASE_ANON_KEY` → paste your Supabase anon key
6. Click **Deploy**
7. Wait ~2 mins — Vercel gives you a live URL like `oht-command-center.vercel.app`

---

## STEP 4 — Connect Your Domain (optional, 5 mins)

To use `app.ohheythere.cafe` instead of the Vercel URL:

1. In Vercel → your project → **Settings → Domains**
2. Add `app.ohheythere.cafe`
3. Vercel shows you a CNAME record to add
4. Go to wherever ohheythere.cafe DNS is managed (Shopify Domains / GoDaddy / etc.)
5. Add the CNAME record Vercel gives you
6. Wait 10–30 mins for DNS to propagate

---

## STEP 5 — Test It

1. Go to your live URL
2. Sign in with Alex's email + password → you should see the dashboard
3. Sign out, sign in with CJ's email + password → works too
4. Share the URL with CJ

---

## ✅ You're live!

**Your trial includes:**
- Real login for Alex and CJ
- Dashboard with KPIs and today's shifts
- Navigation to all modules
- Scheduling and Task Board (full HTML versions linked below)

**Standalone prototypes** (use these while the full app is being built):
- Scheduler: `ohheythere_scheduler.html` — open in any browser
- Task Board: `ohheythere_taskboard.html` — open in any browser

---

## Troubleshooting

**"Invalid login credentials"**
→ Double-check the email and password you created in Supabase Authentication

**"Cannot connect to database"**
→ Check that your Vercel environment variables are correct (no extra spaces)

**Page shows blank / error**
→ Check Vercel deployment logs under your project → Deployments → click the latest one

---

## Next Sprint (when you're ready)

When you come back, we'll build:
1. Scheduler wired to Supabase (saves schedules, persists between sessions)
2. Task Board wired to Supabase (real task data per employee)
3. Payroll module
4. Staff Directory with employee portal logins
5. Messenger notification integration

---

*Built for Oh Hey There by Alex & Claude · May 2026*
