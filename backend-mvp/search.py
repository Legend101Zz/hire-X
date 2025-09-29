from pymongo import MongoClient
import re

# Connect to MongoDB (update if you use auth)
client = MongoClient("mongodb://localhost:27017")

# Select DB and collection
db = client["mydatabase"]
profiles = db["profiles"]

def search_profiles(location=None, country=None, industry=None, expertise=None):
    query = {}

    # Location filter (exact or partial string match, case-insensitive)
    if location:
        query["location"] = {"$regex": re.escape(location), "$options": "i"}
    
    # Country filter (exact match, case-insensitive)
    if country:
        query["country"] = {"$regex": f"^{re.escape(country)}$", "$options": "i"}
    
    # Current industry filter (substring, case-insensitive)
    if industry:
        query["current_industry"] = {"$regex": industry, "$options": "i"}
    
    # Expertise filter (substring, case-insensitive)
    if expertise:
        query["expertise"] = {"$regex": expertise, "$options": "i"}
    
    # Run query
    results = list(profiles.find(query))
    return results


# ----------------
# Example usage:
# ----------------
if __name__ == "__main__":
    matches = search_profiles(
        location="Lucknow",
        country="",
        industry="design",
        expertise="photoshop"
    )
    
    for m in matches:
        print(m)
        print("-" * 40)
