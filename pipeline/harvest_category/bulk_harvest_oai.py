"""Bulk harvest papers from arXiv via OAI-PMH."""

import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import tyro

sys.path.append(str(Path(__file__).parent.parent))
import config
from database import PipelineDB
from oai_harvester import harvest_category


def main(
    category: str = "cs",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: Optional[int] = None,
) -> None:
    """
    Harvest papers from arXiv OAI-PMH by category with optional date filtering.
    
    Dates must be in YYYY-MM-DD format (e.g., '2025-11-17').
    """
    db_path = str(Path(config.LOCAL_CS_DB_PATH).parent / f"{category}.db")
    
    print(f"\nBulk Harvest (OAI-PMH)", file=sys.stderr)
    print(f"{'='*60}", file=sys.stderr)
    print(f"Database:  {db_path}", file=sys.stderr)
    print(f"Category:  {category}", file=sys.stderr)
    if start_date or end_date:
        print(f"Date range: {start_date or 'earliest'} to {end_date or 'latest'}", file=sys.stderr)
    if limit:
        print(f"Limit:     {limit} papers", file=sys.stderr)
    
    db = PipelineDB(db_path)
    db.create_tables()
    
    if start_date and not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')
    
    print(f"\nHarvesting from OAI-PMH...", file=sys.stderr)
    papers = harvest_category(
        category=category,
        from_date=start_date,
        until_date=end_date,
        limit=limit,
        db=db,
        checkpoint_interval=100_000
    )
    
    if not papers:
        print(f"\n✓ No papers harvested", file=sys.stderr)
        db.close()
        return
    
    stats = db.get_stats()
    print(f"\n{'='*60}", file=sys.stderr)
    print(f"Summary", file=sys.stderr)
    print(f"{'='*60}", file=sys.stderr)
    print(f"Harvested:   {len(papers)} papers", file=sys.stderr)
    print(f"Total in DB: {stats['papers']} papers", file=sys.stderr)
    
    db.close()
    print(f"\n✓ Complete!", file=sys.stderr)


if __name__ == "__main__":
    tyro.cli(main)
