"""
Filter papers by category from all available databases.

Searches across all *.db files in the pipeline directory for papers that
have the specified category in their categories array.
"""

import sys
import json
import sqlite3
from pathlib import Path
import tyro

sys.path.append(str(Path(__file__).parent.parent))
from database import PipelineDB

# TODO: make this more efficient; don't filtering all databases for all time ranges


def main(category: str, batch_size: int = 10000) -> None:
    """
    Filter papers by category from all available databases using batch processing.
    
    Args:
        category: Category to filter for (e.g., 'cs.CV', 'stat.ML')
        batch_size: Number of papers to process at a time
    """
    pipeline_dir = Path(__file__).parent.parent
    category_safe = category.replace('.', '_')
    target_db = pipeline_dir / f"filtered_{category_safe}.db"
    
    print(f"\nFilter {category} Papers (Batch Mode)", file=sys.stderr)
    print(f"{'='*60}", file=sys.stderr)
    print(f"Category:   {category}", file=sys.stderr)
    print(f"Target:     {target_db}", file=sys.stderr)
    print(f"Batch size: {batch_size:,} papers", file=sys.stderr)
    
    source_dbs = sorted(pipeline_dir.glob("*.db"))
    source_dbs = [db for db in source_dbs if not db.name.startswith('filtered_') and db.name != 'pipeline.db']
    
    if not source_dbs:
        print(f"\n✗ Error: No source databases found in {pipeline_dir}", file=sys.stderr)
        sys.exit(1)
    
    print(f"\nFound {len(source_dbs)} source databases:", file=sys.stderr)
    for db in source_dbs:
        print(f"  - {db.name}", file=sys.stderr)
    
    if target_db.exists():
        print(f"\n  Warning: Target database exists, will be overwritten", file=sys.stderr)
        target_db.unlink()
    
    print(f"\nCreating target database...", file=sys.stderr)
    target_db_obj = PipelineDB(str(target_db))
    target_db_obj.create_tables()
    
    total_source_papers = 0
    total_processed = 0
    total_transferred = 0
    
    for source_db in source_dbs:
        print(f"\n{'='*60}", file=sys.stderr)
        print(f"Processing: {source_db.name}", file=sys.stderr)
        print(f"{'='*60}", file=sys.stderr)
        
        try:
            source_conn = sqlite3.connect(str(source_db))
            source_conn.row_factory = sqlite3.Row
            source_cursor = source_conn.cursor()
            
            source_cursor.execute("SELECT COUNT(*) as count FROM papers")
            db_total_papers = source_cursor.fetchone()['count']
            total_source_papers += db_total_papers
            print(f"  Total papers in {source_db.name}: {db_total_papers:,}", file=sys.stderr)
            
            offset = 0
            db_processed = 0
            db_transferred = 0
            
            while True:
                source_cursor.execute(f"SELECT * FROM papers LIMIT ? OFFSET ?", (batch_size, offset))
                batch = source_cursor.fetchall()
                
                if not batch:
                    break
                
                for paper in batch:
                    db_processed += 1
                    total_processed += 1
                    
                    categories = json.loads(paper['categories'])
                    if category not in categories:
                        continue
                    
                    try:
                        paper_data = {
                            'id': paper['id'],
                            'title': paper['title'],
                            'authors': json.loads(paper['authors']),
                            'categories': categories,
                            'primary_category': paper['primary_category'],
                            'abstract': paper['abstract'],
                            'submitted_date': paper['submitted_date'],
                            'announce_date': paper['announce_date'],
                            'scraped_date': paper['scraped_date'],
                            'pdf_url': paper['pdf_url'],
                            'code_url': paper['code_url'],
                            'project_url': paper['project_url'],
                            'comments': paper['comments']
                        }
                        target_db_obj.insert_paper(paper_data)
                        db_transferred += 1
                        total_transferred += 1
                            
                    except Exception as e:
                        print(f"  Warning: Failed to transfer {paper['id']}: {e}", file=sys.stderr)
                
                offset += batch_size
                progress_pct = (db_processed / db_total_papers * 100) if db_total_papers > 0 else 0
                print(f"  [{source_db.name}] {db_processed:,}/{db_total_papers:,} ({progress_pct:.1f}%) | "
                      f"Found: {db_transferred:,} {category} papers", file=sys.stderr)
                
                if len(batch) < batch_size:
                    break
            
            print(f"  Completed {source_db.name}: {db_transferred:,} {category} papers found", file=sys.stderr)
            source_conn.close()
            
        except Exception as e:
            print(f"  Error processing {source_db.name}: {e}", file=sys.stderr)
    
    stats = target_db_obj.get_stats()
    
    print(f"\n{'='*60}", file=sys.stderr)
    print(f"Summary", file=sys.stderr)
    print(f"{'='*60}", file=sys.stderr)
    print(f"Source databases:  {len(source_dbs)}", file=sys.stderr)
    print(f"Source papers:     {total_source_papers:,}", file=sys.stderr)
    print(f"Processed:         {total_processed:,}", file=sys.stderr)
    print(f"{category} papers:    {total_transferred:,}", file=sys.stderr)
    print(f"Target DB papers:  {stats['papers']:,}", file=sys.stderr)
    if total_processed > 0:
        print(f"Percentage {category}: {(total_transferred/total_processed*100):.1f}%", file=sys.stderr)
    print(f"\nNote: Figures will be extracted and uploaded directly to R2, not stored locally.", file=sys.stderr)
    
    target_db_obj.close()
    
    print(f"\n✓ Complete! Saved to: {target_db}", file=sys.stderr)


if __name__ == "__main__":
    tyro.cli(main)
