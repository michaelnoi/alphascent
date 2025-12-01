"""
Sync dev.db to wrangler's local D1 database.

This script finds wrangler's local database file and replaces it with dev.db.
Run this after starting wrangler pages dev --local --persist
"""

import sys
import shutil
from pathlib import Path


def find_wrangler_dbs(project_root: Path):
    """Find all wrangler local D1 database files."""
    wrangler_d1_dir = project_root / ".wrangler" / "state" / "v3" / "d1" / "miniflare-D1DatabaseObject"
    
    if not wrangler_d1_dir.exists():
        return []
    
    sqlite_files = list(wrangler_d1_dir.rglob("*.sqlite"))
    sqlite_files.extend(list(wrangler_d1_dir.rglob("*.db")))
    
    return sqlite_files


def sync_dev_db_to_wrangler():
    """Sync dev.db to all wrangler local databases."""
    project_root = Path(__file__).parent.parent.parent
    dev_db = project_root / "dev.db"
    
    if not dev_db.exists():
        print(f"Error: dev.db not found at {dev_db}", file=sys.stderr)
        print(f"Run: python pipeline/db_util/build_local_debug_db.py first", file=sys.stderr)
        sys.exit(1)
    
    wrangler_dbs = find_wrangler_dbs(project_root)
    
    if not wrangler_dbs:
        print(f"Error: Wrangler local databases not found", file=sys.stderr)
        print(f"Make sure you've run: wrangler pages dev --local", file=sys.stderr)
        sys.exit(1)
    
    print(f"Syncing dev.db to {len(wrangler_dbs)} wrangler local database(s)...", file=sys.stderr)
    print(f"  Source: {dev_db}", file=sys.stderr)
    
    synced_count = 0
    for wrangler_db in wrangler_dbs:
        try:
            print(f"  Syncing to: {wrangler_db.name}", file=sys.stderr)
            shutil.copy2(dev_db, wrangler_db)
            synced_count += 1
        except Exception as e:
            print(f"  Warning: Failed to sync to {wrangler_db.name}: {e}", file=sys.stderr)
    
    if synced_count > 0:
        print(f"✓ Successfully synced to {synced_count} database(s)", file=sys.stderr)
    else:
        print(f"✗ Failed to sync to any database", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    sync_dev_db_to_wrangler()
