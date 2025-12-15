# 🚀 Pune Mission Control Setup Guide

This guide will help you set up the backend and data for the "Street-Level Mission Control" feature, specifically targeting **Pune, India**.

## ✅ Security & Schema Validation
You asked to ensure no conflicts with your existing schema (`tree_results`, `user_profiles`, etc.).
- **No Conflicts:** The new tables (`campaigns`, `squads`, `street_segments`) are completely new and do not touch your existing data tables.
- **Safe Integration:** We only reference `auth.users` (the standard Supabase user table) to link users to squads and tasks.
- **RLS Protection:** We have added Row Level Security policies to ensure users can only modify their own data (joining squads, locking segments).

---

## Step 1: Database Setup (Supabase)

1.  Go to your **Supabase Dashboard**.
2.  Open the **SQL Editor** from the left sidebar.
3.  Click **New Query**.
4.  Copy the **entire content** of the file:
    `supabase/migrations/20251215_missions_schema_revised.sql`
5.  Paste it into the SQL Editor and click **Run**.
    *   *Success:* You should see "Success" or "No rows returned".
    *   *Verify:* Go to the **Table Editor** and check if `campaigns`, `squads`, and `street_segments` tables now exist.

---

## Step 2: Python Environment Setup

We need to run a Python script to fetch the street data for Pune from OpenStreetMap.

1.  Open your terminal (PowerShell or Command Prompt).
2.  Navigate to the `scripts` folder:
    ```powershell
    cd "d:\FYP\Image New Calculation\FrontEnd\project-bolt-sb1-k44zmwc9\project\scripts"
    ```
3.  Install the required libraries:
    ```powershell
    pip install -r requirements.txt
    ```
    *(Note: `osmnx` can sometimes be tricky to install. If you get errors, try `conda install -c conda-forge osmnx` if you use Anaconda, or let me know.)*

---

## Step 3: Generate Pune Street Data

1.  Run the generation script:
    ```powershell
    python generate_street_segments.py
    ```
2.  **Wait**: It will download map data for "Pune, Maharashtra, India". This might take 1-2 minutes depending on your internet.
3.  **Result**: You should see a new file `street_segments.json` appear in the `scripts` folder.

---

## Step 4: Upload Data to Supabase

1.  **Get Credentials**:
    *   Go to Supabase Dashboard -> **Project Settings** -> **API**.
    *   Copy the **Project URL**.
    *   Copy the **service_role** secret (This is needed to bypass RLS for the bulk upload. **Do not share this key publicly**).

2.  **Edit the Script**:
    *   Open `scripts/upload_segments_to_supabase.py`.
    *   Replace `YOUR_SUPABASE_URL` with your copied URL.
    *   Replace `YOUR_SUPABASE_SERVICE_ROLE_KEY` with your copied `service_role` key.
    *   *Save the file.*

3.  **Run the Upload**:
    ```powershell
    python upload_segments_to_supabase.py
    ```
4.  **Success**: The script will print "Campaign created" and then upload the segments in batches.

---

## Step 5: Verify in App

1.  Start your frontend:
    ```powershell
    npm run dev
    ```
2.  Open the app and go to the **Missions** tab.
3.  You should now see the map of Pune with street segments loaded!
