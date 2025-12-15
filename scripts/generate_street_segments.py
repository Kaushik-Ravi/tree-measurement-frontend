import osmnx as ox
import json
import sys

# Configuration
# You can run this script with a place name argument: python generate_segments.py "Brooklyn, New York"
PLACE_NAME = "Central Park, New York, USA" 
OUTPUT_FILE = "street_segments.json"

def generate_segments(place_name):
    print(f"Fetching data for: {place_name}...")
    
    try:
        # 1. Download the street network (walkable)
        # 'network_type="walk"' ensures we get sidewalks/paths too. Use "drive" for just roads.
        # simplify=True is default, which gives us intersection-to-intersection segments.
        G = ox.graph_from_place(place_name, network_type='walk')
    except Exception as e:
        print(f"Error fetching data: {e}")
        return

    # 2. Convert to undirected graph to avoid duplicate segments for two-way streets
    G_undir = ox.get_undirected(G)
    
    segments = []
    
    print("Processing segments...")
    for u, v, data in G_undir.edges(data=True):
        # OSMnx edges have a 'geometry' attribute if they are curved.
        # If straight, they might not. We need to construct it from nodes u and v.
        
        coords = []
        if 'geometry' in data:
            # Shapely LineString
            # mapping: (lon, lat)
            coords = list(data['geometry'].coords)
        else:
            # Straight line between nodes
            node_u = G_undir.nodes[u]
            node_v = G_undir.nodes[v]
            coords = [(node_u['x'], node_u['y']), (node_v['x'], node_v['y'])]
            
        # Length (OSMnx calculates this in meters automatically)
        length = data.get('length', 0)
        
        # Name
        name = data.get('name', 'Unnamed Path')
        if isinstance(name, list):
            name = " / ".join(name)
            
        segment = {
            "type": "Feature",
            "properties": {
                "name": name,
                "length_meters": round(length, 1),
                "osmid": str(data.get('osmid', 0))
            },
            "geometry": {
                "type": "LineString",
                "coordinates": coords
            }
        }
        segments.append(segment)
        
    print(f"Generated {len(segments)} segments.")
    
    # Save to file
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(segments, f, indent=2)
        
    print(f"Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        PLACE_NAME = sys.argv[1]
    generate_segments(PLACE_NAME)
