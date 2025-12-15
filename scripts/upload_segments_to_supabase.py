import json
import os
from supabase import create_client, Client
import sys

# Configuration
# Get these from your Supabase Project Settings -> API
SUPABASE_URL = "https://wsrzqmvnmgihumnlddgj.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzcnpxbXZubWdpaHVtbmxkZGdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDUzMTkwNCwiZXhwIjoyMDc2MTA3OTA0fQ.t1-l0MCmpcQ7F8sQSjPe6SJKAwlDnEH_ps2ASGOmiyI" # Use Service Role Key to bypass RLS for bulk upload if needed, or Anon key if RLS allows insert

INPUT_FILE = "street_segments.json"
CAMPAIGN_NAME = "Pune Census 2025"

def upload_data():
    print("Initializing Supabase client...")
    if "YOUR_SUPABASE_URL" in SUPABASE_URL:
        print("❌ Error: Please update the script with your actual SUPABASE_URL and SUPABASE_KEY.")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 1. Create a Campaign
    print(f"Creating campaign: {CAMPAIGN_NAME}...")
    campaign_data = {
        "title": CAMPAIGN_NAME,
        "description": "Street census for Pune",
        "status": "active"
    }
    
    res = supabase.table("campaigns").insert(campaign_data).execute()
    if not res.data:
        print("Error creating campaign:", res)
        return
        
    campaign_id = res.data[0]['id']
    print(f"✅ Campaign created with ID: {campaign_id}")

    # 2. Load Segments
    print(f"Loading segments from {INPUT_FILE}...")
    try:
        with open(INPUT_FILE, 'r') as f:
            segments = json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: {INPUT_FILE} not found. Run generate_street_segments.py first.")
        return

    # 3. Prepare Data for Insert
    print(f"Preparing {len(segments)} segments for upload...")
    
    rows_to_insert = []
    for seg in segments:
        props = seg['properties']
        geom = seg['geometry']
        
        row = {
            "campaign_id": campaign_id,
            "name": props.get('name', 'Unnamed Street'),
            "length_meters": props.get('length_meters', 0),
            "geometry": geom, # PostGIS/Supabase handles JSONB geometry if set up, or we might need to cast. 
                              # For this schema, we used 'jsonb' for geometry column, so passing the dict is correct.
            "status": "available"
        }
        rows_to_insert.append(row)

    # 4. Batch Upload (Supabase has limits, usually 1000 rows per request)
    BATCH_SIZE = 100
    total_uploaded = 0
    
    print("Starting upload...")
    for i in range(0, len(rows_to_insert), BATCH_SIZE):
        batch = rows_to_insert[i:i+BATCH_SIZE]
        res = supabase.table("street_segments").insert(batch).execute()
        total_uploaded += len(batch)
        print(f"Uploaded {total_uploaded}/{len(rows_to_insert)} segments...")

    print("✅ Upload complete!")

if __name__ == "__main__":
    upload_data()
