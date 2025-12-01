"""Upload papers from local SQLite to D1 in batches."""

import sys
from pathlib import Path
from typing import Optional
import tyro

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "pipeline"))

from database import PipelineDB
from d1_client import D1Client
import config


def get_existing_papers_d1(d1: D1Client, category: str) -> set:
    """Query D1 once for all existing paper IDs"""
    table_name = f'papers_{category.lower().replace(".", "_")}'
    print(f"Querying D1 {table_name}...", file=sys.stderr)
    
    try:
        results = d1.query(f"SELECT id FROM {table_name}")
        existing = {row['id'] for row in results}
        print(f"  Found {len(existing):,} existing", file=sys.stderr)
        return existing
    except:
        print(f"  Table may not exist yet, assuming empty", file=sys.stderr)
        return set()


def batch_upload_papers(d1: D1Client, papers: list, category: str, batch_size: int = 50):
    """Batch upload papers to D1 with minimal API calls"""
    table_name = f'papers_{category.lower().replace(".", "_")}'
    total = len(papers)
    
    print(f"\nUploading {total:,} papers in batches of {batch_size}...", file=sys.stderr)
    
    for i in range(0, total, batch_size):
        batch = papers[i:i + batch_size]
        
        # Build batch INSERT statements
        sql_statements = []
        for p in batch:
            # Escape single quotes
            def esc(v):
                if v is None:
                    return "NULL"
                return f"'{str(v).replace(chr(39), chr(39)*2)}'"
            
            sql_statements.append(
                f"INSERT INTO {table_name} "
                f"(id, title, authors, categories, primary_category, abstract, "
                f"submitted_date, announce_date, scraped_date, pdf_url, code_url, project_url, comments, created_at) "
                f"VALUES ({esc(p['id'])}, {esc(p['title'])}, {esc(p['authors'])}, {esc(p['categories'])}, "
                f"{esc(p['primary_category'])}, {esc(p['abstract'])}, {esc(p['submitted_date'])}, "
                f"{esc(p['announce_date'])}, {esc(p['scraped_date'])}, {esc(p['pdf_url'])}, "
                f"{esc(p['code_url'])}, {esc(p['project_url'])}, {esc(p['comments'])}, {esc(p['created_at'])}) "
                f"ON CONFLICT(id) DO UPDATE SET title=excluded.title, authors=excluded.authors, "
                f"abstract=excluded.abstract, submitted_date=excluded.submitted_date, announce_date=excluded.announce_date, "
                f"scraped_date=excluded.scraped_date, pdf_url=excluded.pdf_url, code_url=excluded.code_url, "
                f"project_url=excluded.project_url, comments=excluded.comments"
            )
        
        # Execute batch
        sql = ';\n'.join(sql_statements) + ';'
        
        try:
            d1.query(sql)  # Using query method which sends SQL via HTTP API
            batch_num = i // batch_size + 1
            total_batches = (total - 1) // batch_size + 1
            print(f"  ✓ Batch {batch_num}/{total_batches} ({len(batch)} papers)", file=sys.stderr)
        except Exception as e:
            print(f"  ✗ Batch {i//batch_size + 1} failed: {e}", file=sys.stderr)
            raise


def main(
    db: str,
    category: str,
    limit: Optional[int] = None,
    batch_size: int = 100,
    force: bool = False,
) -> None:
    """
    Upload papers from a local SQLite DB to D1.

    Args:
        db: Path to local SQLite DB with a `papers` table (e.g. `pipeline/filtered_cs_CV.db`).
        category: D1 category/table suffix (e.g. `cs.CV`, `cs.HC`).
        limit: Optional cap on number of new papers to upload (most recent first).
        batch_size: Number of papers per D1 batch insert.
        force: If True, skip querying D1 for existing IDs (may create more API load).
    """
    # TODO: better upload logic and store databases somewhere else locally
    db_path = PROJECT_ROOT / db
    if not db_path.exists():
        print(f"Database not found: {db_path}", file=sys.stderr)
        sys.exit(1)
    
    print("\nLocal → D1 Upload", file=sys.stderr)
    print("=" * 60, file=sys.stderr)
    print(f"Category: {category}", file=sys.stderr)
    print(f"Database: {db_path.name}", file=sys.stderr)
    
    # 1. Load local papers (all, most recent first)
    local_db = PipelineDB(str(db_path))
    cursor = local_db.conn.cursor()
    cursor.execute("SELECT * FROM papers ORDER BY submitted_date DESC")
    all_papers = [dict(row) for row in cursor.fetchall()]
    print(f"\nLoading local papers...", file=sys.stderr)
    print(f"  Found {len(all_papers):,} total papers", file=sys.stderr)
    
    # 2. Query D1 for existing, then filter and upload
    d1 = D1Client({
        'account_id': config.CLOUDFLARE_ACCOUNT_ID,
        'database_id': config.D1_DATABASE_ID,
        'api_token': config.D1_API_TOKEN
    })
    
    existing = set() if force else get_existing_papers_d1(d1, category)
    if force:
        print(f"  Skipping D1 check (--force)", file=sys.stderr)
    
    # 3. Filter out existing, then apply limit
    to_upload = [p for p in all_papers if p['id'] not in existing]
    total_new = len(to_upload)
    
    if limit and total_new > limit:
        to_upload = to_upload[:limit]
        print(f"\n{limit:,} new papers to upload (limited from {total_new:,} available)", file=sys.stderr)
    elif total_new > 0:
        print(f"\n{total_new:,} new papers to upload", file=sys.stderr)
    else:
        print("\n✓ All papers already in D1!", file=sys.stderr)
        local_db.close()
        return
    
    # 4. Batch upload
    try:
        batch_upload_papers(d1, to_upload, category, batch_size=batch_size)
        print(f"\n✓ Upload complete!", file=sys.stderr)
    except Exception as e:
        print(f"\nUpload failed: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        local_db.close()


if __name__ == "__main__":
    tyro.cli(main)
