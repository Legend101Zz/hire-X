#!/usr/bin/env python3
"""
Test the new two-tiered search and ranking system with preflight check.
"""
import json
import os
from datetime import datetime
from typing import List

from ai_model import Model
from dotenv import load_dotenv
from enhanced_parser import EnhancedPromptParser
from followup_generator import generate_followup_questions
from improved_search import ImprovedSearcher
from preflight_check import PreflightChecker
from pymongo import MongoClient
from query_refiner import refine_query_interactive
from scoring import CandidateScorer

load_dotenv()


class SearchTester:
    """Test the new search workflow with preflight check."""
    
    def __init__(self):
        # Setup MongoDB connections
        profiles_db_url = os.getenv("PROFILES_DB_URL", "mongodb://localhost:27017")
        profiles_db_name = os.getenv("PROFILES_DB_NAME", "mydatabase")
        client = MongoClient(profiles_db_url)
        self.profiles_collection = client[profiles_db_name]["profiles"]
        
        # Setup components
        self.model = Model()
        self.parser = EnhancedPromptParser(self.model)
        self.searcher = ImprovedSearcher(self.profiles_collection)
        self.scorer = CandidateScorer(self.model)
        self.preflight = PreflightChecker(self.profiles_collection)
        
        # Config
        self.TOP_N = 5
    
    def run_interactive_test(self):
        """Run interactive test via terminal."""
        print("=" * 80)
        print("🔬 TWO-TIERED SEARCH & RANKING SYSTEM - TEST")
        print("=" * 80)
        print()
        
        # Step 1: Get user query
        print("📝 STEP 1: Enter your job requirement")
        print("-" * 80)
        print("Example: 'Looking for a Senior Python Developer in San Francisco with 5+ years experience'")
        print()
        user_query = input("Enter your query: ").strip()
        
        if not user_query:
            print("❌ No query provided. Exiting.")
            return
        
        print()
        print("=" * 80)
        
        # Step 2: Parse with enhanced parser
        print("🧠 STEP 2: Parsing query with LLM...")
        print("-" * 80)
        parsed_data = self.parser.parse_with_tiers(user_query)
        
        print("\n✅ Parsing complete!")
        print(f"\n📊 STRICT PARAMS (MANDATORY):")
        print(json.dumps(parsed_data["strict_params"], indent=2))
        
        input("\nPress Enter to run preflight check...")
        print()
        print("=" * 80)
        
        # Step 2.5: PREFLIGHT CHECK
        print("🔍 STEP 2.5: Preflight Check")
        print("-" * 80)
        
        preflight_results = self.preflight.check_query_viability(
            parsed_data["strict_params"]
        )
        
        # If query not viable, let user refine it
        if not preflight_results["viable"]:
            parsed_data = refine_query_interactive(
                user_query,
                preflight_results,
                parsed_data,
                self.preflight 
            )
            
            if parsed_data is None:
                print("\n👋 Search cancelled. Goodbye!")
                return
            
            # Re-run preflight with updated criteria
            print("\n🔄 Re-checking with updated criteria...")
            preflight_results = self.preflight.check_query_viability(
                parsed_data["strict_params"]
            )
            
            if not preflight_results["viable"]:
                print("\n❌ Still no results. Please try a different query.")
                return
        
        print(f"\n✅ Preflight passed! Expected ~{preflight_results['results_count']} results")
        
        input("\nPress Enter to search database...")
        print()
        print("=" * 80)
        
        # Step 3: Database search with mandatory filters
        print("🔍 STEP 3: Searching database...")
        print("-" * 80)
        
        profiles = self.searcher.search_with_mandatory_filters(
            mandatory=parsed_data["strict_params"],
            optional=parsed_data["broad_params"],
            min_results=50
        )
        
        if not profiles:
            print("❌ No profiles found. This shouldn't happen after preflight!")
            return
        
        print(f"\n✅ Found {len(profiles)} candidates!")
        
        input("\nPress Enter to continue to scoring...")
        print()
        print("=" * 80)
        
        # Step 4: Tier 1 Pre-scoring
        print(f"📊 STEP 4: Pre-scoring {len(profiles)} candidates (Tier 1)...")
        print("-" * 80)
        
        for profile in profiles:
            pre_score = self.scorer.calculate_pre_score(profile, parsed_data["scoring_rules"])
            profile["pre_score"] = pre_score
        
        # Sort by pre_score
        profiles.sort(key=lambda x: x.get("pre_score", 0), reverse=True)
        
        print(f"\n✅ Pre-scoring complete!")
        print(f"\nTop 5 by pre-score:")
        for i, p in enumerate(profiles[:5]):
            name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip()
            print(f"  {i+1}. {name} - {p.get('title', 'N/A')} (Score: {p.get('pre_score', 0)})")
        
        # Step 4.5: Follow-up questions
        print("\n" + "=" * 80)
        print("❓ STEP 4.5: Follow-up Questions to Refine Results")
        print("-" * 80)
        
        followup_questions = generate_followup_questions(user_query, profiles, parsed_data)
        
        if followup_questions:
            print("\nBased on initial results, please answer these questions:")
            for i, question in enumerate(followup_questions, 1):
                print(f"\n{i}. {question['question']}")
                if question.get('options'):
                    for opt in question['options']:
                        print(f"   - {opt}")
                answer = input(f"   Your answer: ").strip()
                question['answer'] = answer
            
            print("\n✅ Using your answers to refine rankings...")
        else:
            print("\n✅ No additional questions needed.")
        
        input(f"\nPress Enter to continue to AI ranking (top {self.TOP_N})...")
        print()
        print("=" * 80)
        
        # Step 5: Tier 2 Final AI Ranking
        print(f"🤖 STEP 5: AI ranking top {self.TOP_N} candidates (Tier 2)...")
        print("-" * 80)
        
        final_ranked = self.scorer.get_final_rankings(profiles, user_query, self.TOP_N)
        
        print(f"\n✅ Final ranking complete!")
        print(f"\n🏆 FINAL TOP {min(len(final_ranked), 10)} RESULTS:")
        print("=" * 80)
        
        for i, candidate in enumerate(final_ranked[:10]):
            name = f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip()
            title = candidate.get('title', 'N/A')
            location = candidate.get('location', 'N/A')
            industry = candidate.get('current_industry', 'N/A')
            final_score = candidate.get('final_score', 0)
            summary = candidate.get('summary', 'No summary')
            
            print(f"\n{i+1}. {name}")
            print(f"   Title: {title}")
            print(f"   Location: {location}")
            print(f"   Industry: {industry}")
            print(f"   Final Score: {final_score}/100")
            print(f"   Summary: {summary}")
        
        print()
        print("=" * 80)
        
        # Step 6: Save results
        save = input("\n💾 Save results to file? (y/n): ").strip().lower()
        
        if save == 'y':
            self._save_results(user_query, final_ranked)
    
    def _save_results(self, query: str, results: List):
        """Save results to files."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        json_filename = f"search_results_{timestamp}.json"
        with open(json_filename, 'w') as f:
            json.dump({
                "query": query,
                "timestamp": timestamp,
                "total_results": len(results),
                "results": results
            }, f, indent=2, default=str)
        
        print(f"✅ Saved JSON to: {json_filename}")
        
        txt_filename = f"search_results_{timestamp}.txt"
        with open(txt_filename, 'w') as f:
            f.write("=" * 80 + "\n")
            f.write("SEARCH RESULTS\n")
            f.write("=" * 80 + "\n\n")
            f.write(f"Query: {query}\n")
            f.write(f"Timestamp: {timestamp}\n")
            f.write(f"Total Results: {len(results)}\n\n")
            f.write("=" * 80 + "\n")
            f.write("TOP CANDIDATES\n")
            f.write("=" * 80 + "\n\n")
            
            for i, candidate in enumerate(results):
                name = f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip()
                f.write(f"\n{i+1}. {name}\n")
                f.write(f"   Title: {candidate.get('title', 'N/A')}\n")
                f.write(f"   Location: {candidate.get('location', 'N/A')}\n")
                f.write(f"   Industry: {candidate.get('current_industry', 'N/A')}\n")
                f.write(f"   Skills: {candidate.get('expertise', 'N/A')}\n")
                f.write(f"   Pre-Score: {candidate.get('pre_score', 0)}\n")
                f.write(f"   Final Score: {candidate.get('final_score', 0)}/100\n")
                f.write(f"   Summary: {candidate.get('summary', 'No summary')}\n")
                f.write("\n" + "-" * 80 + "\n")
        
        print(f"✅ Saved TXT to: {txt_filename}")


def main():
    """Main entry point."""
    tester = SearchTester()
    tester.run_interactive_test()


if __name__ == "__main__":
    main()