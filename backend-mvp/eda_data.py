# scripts/eda_profiles.py
"""
Exploratory Data Analysis for profile data.

This script helps you understand:
1. Data structure and fields
2. Data completeness (how many NA/null values)
3. Data quality issues
4. Field statistics
"""
import json
import os
from collections import Counter, defaultdict
from typing import Any, Dict, List

import pandas as pd


class ProfileEDA:
    """Analyze profile data before import."""
    
    def __init__(self, data_directory: str):
        """
        Initialize EDA.
        
        Args:
            data_directory: Path to directory containing JSONL files
        """
        self.data_dir = data_directory
        self.jsonl_files = [f for f in os.listdir(data_directory) if f.endswith('.jsonl')]
        
        print(f"📁 Found {len(self.jsonl_files)} JSONL files in {data_directory}")
        for f in self.jsonl_files:
            size_mb = os.path.getsize(os.path.join(data_directory, f)) / (1024**2)
            print(f"   - {f}: {size_mb:.1f} MB")
    
    def analyze_structure(self, sample_size: int = 1000):
        """
        Analyze data structure from sample.
        
        This reads the first 1000 profiles to understand:
        - What fields exist
        - What types each field has
        - How complete each field is
        """
        print("\n" + "=" * 80)
        print("🔍 ANALYZING DATA STRUCTURE")
        print("=" * 80)
        
        # Read sample from first file
        first_file = os.path.join(self.data_dir, self.jsonl_files[2])
        
        profiles = []
        with open(first_file, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                if i >= sample_size:
                    break
                try:
                    profile = json.loads(line)
                    profiles.append(profile)
                except json.JSONDecodeError as e:
                    print(f"⚠️  Line {i} has invalid JSON: {e}")
        
        print(f"\n✅ Loaded {len(profiles)} sample profiles")
        
        # Analyze fields
        all_fields = set()
        field_types = defaultdict(Counter)
        field_completeness = defaultdict(int)
        
        for profile in profiles:
            all_fields.update(profile.keys())
            
            for field, value in profile.items():
                # Track types
                if value is None or value == "NA" or value == "":
                    field_types[field]["null/empty"] += 1
                elif isinstance(value, str):
                    field_types[field]["string"] += 1
                elif isinstance(value, (int, float)):
                    field_types[field]["number"] += 1
                elif isinstance(value, list):
                    field_types[field]["array"] += 1
                elif isinstance(value, dict):
                    field_types[field]["object"] += 1
                
                # Track completeness
                if value and value != "NA":
                    field_completeness[field] += 1
        
        # Print results
        print(f"\n📋 Found {len(all_fields)} unique fields:")
        print("-" * 80)
        print(f"{'Field Name':<30} {'Type':<15} {'Completeness':<15} {'Sample Value'}")
        print("-" * 80)
        
        for field in sorted(all_fields):
            # Most common type
            types = field_types[field]
            most_common_type = types.most_common(1)[0][0] if types else "unknown"
            
            # Completeness percentage
            completeness_pct = (field_completeness[field] / len(profiles)) * 100
            
            # Sample value (first non-null value)
            sample_value = "N/A"
            for profile in profiles:
                if field in profile and profile[field] and profile[field] != "NA":
                    sample_value = str(profile[field])[:40]
                    break
            
            print(f"{field:<30} {most_common_type:<15} {completeness_pct:>5.1f}%         {sample_value}")
        
        return profiles
    
    def analyze_critical_fields(self, profiles: List[Dict]):
        """Analyze the most important fields for search."""
        print("\n" + "=" * 80)
        print("🎯 CRITICAL FIELDS ANALYSIS")
        print("=" * 80)
        
        critical_fields = [
            'first_name', 'last_name', 'title', 'location', 
            'seniority_level', 'current_industry', 'expertise',
            'linkedin_url', 'email'
        ]
        
        print("\n📊 Completeness of critical fields:")
        print("-" * 60)
        print(f"{'Field':<20} {'Has Data':<15} {'Completeness':<15}")
        print("-" * 60)
        
        for field in critical_fields:
            count = sum(1 for p in profiles if p.get(field) and p.get(field) != "NA")
            pct = (count / len(profiles)) * 100
            status = "✅" if pct > 80 else "⚠️" if pct > 50 else "❌"
            print(f"{field:<20} {status} {count:>5}/{len(profiles):<5} {pct:>6.1f}%")
        
        # Check for unique identifiers
        print("\n🔑 Checking unique identifiers:")
        
        # LinkedIn URLs (should be unique)
        linkedin_urls = [p.get('linkedin_url') for p in profiles if p.get('linkedin_url')]
        unique_linkedin = len(set(linkedin_urls))
        print(f"   LinkedIn URLs: {len(linkedin_urls)} total, {unique_linkedin} unique")
        if len(linkedin_urls) != unique_linkedin:
            print(f"   ⚠️  Found {len(linkedin_urls) - unique_linkedin} duplicate LinkedIn URLs!")
    
    def analyze_location_data(self, profiles: List[Dict]):
        """Analyze location field structure."""
        print("\n" + "=" * 80)
        print("📍 LOCATION DATA ANALYSIS")
        print("=" * 80)
        
        locations = [p.get('location') for p in profiles if p.get('location') and p.get('location') != "NA"]
        
        print(f"\nTotal profiles with location: {len(locations)}")
        
        # Sample locations
        print("\n📋 Sample locations (format analysis):")
        for i, loc in enumerate(locations[:10], 1):
            print(f"   {i}. {loc}")
        
        # Analyze location format
        location_patterns = Counter()
        for loc in locations:
            # Count comma-separated parts
            parts = [p.strip() for p in loc.split(',')]
            location_patterns[len(parts)] += 1
        
        print("\n📊 Location format patterns (number of comma-separated parts):")
        for num_parts, count in sorted(location_patterns.items()):
            pct = (count / len(locations)) * 100
            print(f"   {num_parts} parts: {count:>6} ({pct:>5.1f}%)")
        
        # Top cities
        cities = []
        for loc in locations:
            parts = [p.strip() for p in loc.split(',')]
            if parts:
                cities.append(parts[0])  # First part is usually city
        
        print("\n🏙️  Top 20 cities:")
        city_counts = Counter(cities).most_common(20)
        for i, (city, count) in enumerate(city_counts, 1):
            pct = (count / len(locations)) * 100
            print(f"   {i:>2}. {city:<30} {count:>6} ({pct:>5.1f}%)")
    
    def analyze_expertise_data(self, profiles: List[Dict]):
        """Analyze expertise/skills field."""
        print("\n" + "=" * 80)
        print("💼 EXPERTISE/SKILLS ANALYSIS")
        print("=" * 80)
        
        expertise_list = [p.get('expertise') for p in profiles if p.get('expertise') and p.get('expertise') != "NA"]
        
        print(f"\nTotal profiles with expertise: {len(expertise_list)}")
        
        # Sample expertise
        print("\n📋 Sample expertise formats:")
        for i, exp in enumerate(expertise_list[:10], 1):
            print(f"   {i}. {exp[:80]}...")
        
        # Analyze expertise format
        all_skills = []
        for exp in expertise_list:
            # Assuming comma-separated skills
            skills = [s.strip() for s in exp.split(',')]
            all_skills.extend(skills)
        
        print(f"\n📊 Total unique skills found: {len(set(all_skills))}")
        
        # Top skills
        print("\n🎯 Top 30 skills:")
        skill_counts = Counter(all_skills).most_common(30)
        for i, (skill, count) in enumerate(skill_counts, 1):
            pct = (count / len(expertise_list)) * 100
            print(f"   {i:>2}. {skill:<40} {count:>6} ({pct:>5.1f}%)")
    
    def analyze_industry_data(self, profiles: List[Dict]):
        """Analyze industry distribution."""
        print("\n" + "=" * 80)
        print("🏭 INDUSTRY DISTRIBUTION")
        print("=" * 80)
        
        industries = [p.get('current_industry') for p in profiles if p.get('current_industry') and p.get('current_industry') != "NA"]
        
        print(f"\nTotal profiles with industry: {len(industries)}")
        
        # Top industries
        print("\n📊 Top 25 industries:")
        industry_counts = Counter(industries).most_common(25)
        for i, (industry, count) in enumerate(industry_counts, 1):
            pct = (count / len(industries)) * 100
            print(f"   {i:>2}. {industry:<50} {count:>6} ({pct:>5.1f}%)")
    
    def estimate_total_profiles(self):
        """Estimate total number of profiles across all files."""
        print("\n" + "=" * 80)
        print("📏 ESTIMATING TOTAL PROFILES")
        print("=" * 80)
        
        # Count lines in first file
        first_file = os.path.join(self.data_dir, self.jsonl_files[0])
        
        with open(first_file, 'r', encoding='utf-8') as f:
            lines = sum(1 for _ in f)
        
        file_size_mb = os.path.getsize(first_file) / (1024**2)
        
        print(f"\n📊 Sample file analysis:")
        print(f"   File: {self.jsonl_files[0]}")
        print(f"   Size: {file_size_mb:.1f} MB")
        print(f"   Profiles: {lines:,}")
        print(f"   Avg profile size: {file_size_mb / lines * 1024:.2f} KB")
        
        # Estimate total
        total_size_mb = sum(
            os.path.getsize(os.path.join(self.data_dir, f)) / (1024**2)
            for f in self.jsonl_files
        )
        
        estimated_profiles = int((total_size_mb / file_size_mb) * lines)
        
        print(f"\n📊 Total estimation:")
        print(f"   Total files: {len(self.jsonl_files)}")
        print(f"   Total size: {total_size_mb:.1f} MB ({total_size_mb/1024:.1f} GB)")
        print(f"   Estimated profiles: {estimated_profiles:,}")
        
        # Storage estimates
        print(f"\n💾 MongoDB storage estimates:")
        print(f"   Raw data: ~{total_size_mb/1024:.1f} GB")
        print(f"   With indexes: ~{total_size_mb/1024 * 1.5:.1f} GB")
        print(f"   Safe storage needed: ~{total_size_mb/1024 * 2:.1f} GB")
        
        if total_size_mb / 1024 * 2 > 20:
            print(f"\n   💡 Recommendation: Use M30 tier (40GB storage)")
        else:
            print(f"\n   💡 Recommendation: M20 tier (20GB storage) should work")
    
    def run_full_analysis(self):
        """Run complete EDA."""
        print("\n" + "=" * 80)
        print("🚀 STARTING FULL EXPLORATORY DATA ANALYSIS")
        print("=" * 80)
        
        # 1. Analyze structure
        profiles = self.analyze_structure(sample_size=1000)
        
        # 2. Critical fields
        self.analyze_critical_fields(profiles)
        
        # 3. Location analysis
        self.analyze_location_data(profiles)
        
        # 4. Expertise analysis
        self.analyze_expertise_data(profiles)
        
        # 5. Industry analysis
        self.analyze_industry_data(profiles)
        
        # 6. Estimate total
        self.estimate_total_profiles()
        
        print("\n" + "=" * 80)
        print("✅ EDA COMPLETE")
        print("=" * 80)
        print("\n💡 Next steps:")
        print("   1. Review the field completeness above")
        print("   2. Check if critical fields have good data quality")
        print("   3. Verify storage estimate vs your MongoDB tier")
        print("   4. Proceed to import if everything looks good!")


if __name__ == "__main__":
    # USAGE: Update this path to your data directory
    DATA_DIR = "/Volumes/Mrigesh SSD/Neuraleap data"
    
    # Check if path exists
    if not os.path.exists(DATA_DIR):
        print(f"❌ Directory not found: {DATA_DIR}")
        print("\n💡 Update DATA_DIR variable in this script to point to your JSONL files")
        exit(1)
    
    # Run analysis
    eda = ProfileEDA(DATA_DIR)
    eda.run_full_analysis()