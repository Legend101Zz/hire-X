#!/usr/bin/env python3
"""
Script to run the Neuraleap API server from the project root.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend-mvp'))

if __name__ == "__main__":
    from backend_mvp.main import *
