"""
Build a local development database (dev.db) from filtered category databases.

Joins papers from filtered databases (e.g., filtered_cs_CV.db, filtered_cs_HC.db)
into a single dev.db with the production schema for local development.
"""

import sys
import sqlite3
import shutil
from pathlib import Path


def get_category_mapping():
    """Map filtered database names to category table names."""
    return {
        'filtered_cs_CV': ('cs.CV', 'papers_cs_cv'),
        'filtered_cs_HC': ('cs.HC', 'papers_cs_hc'),
        'filtered_cs_GR': ('cs.GR', 'papers_cs_gr'),
    }


def create_production_schema(conn: sqlite3.Connection):
    """Create the full production schema including FTS5 tables and triggers."""
    cursor = conn.cursor()
    
    cursor.executescript("""
        -- Migration 0001: Figures and Access Keys
        CREATE TABLE IF NOT EXISTS figures (
          id TEXT PRIMARY KEY,
          paper_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          r2_key TEXT NOT NULL,
          thumb_key TEXT,
          width INTEGER,
          height INTEGER
        );
        
        CREATE INDEX IF NOT EXISTS idx_figures_paper ON figures(paper_id);
        
        CREATE TABLE IF NOT EXISTS access_keys (
          id TEXT PRIMARY KEY,
          key_hash TEXT UNIQUE NOT NULL,
          user_name TEXT,
          user_email TEXT,
          accessible_dates TEXT NOT NULL,
          issued_at TEXT DEFAULT CURRENT_TIMESTAMP,
          expires_at TEXT,
          last_used_at TEXT,
          last_used_ip TEXT,
          request_count INTEGER DEFAULT 0,
          is_revoked BOOLEAN DEFAULT 0,
          notes TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_access_keys_hash ON access_keys(key_hash);
        CREATE INDEX IF NOT EXISTS idx_access_keys_expires ON access_keys(expires_at);
        
        -- Migration 0002: Category Tables
        CREATE TABLE IF NOT EXISTS papers_cs_cv (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          authors TEXT NOT NULL,
          categories TEXT NOT NULL,
          primary_category TEXT,
          abstract TEXT,
          submitted_date TEXT NOT NULL,
          announce_date TEXT,
          scraped_date TEXT NOT NULL,
          pdf_url TEXT,
          code_url TEXT,
          project_url TEXT,
          comments TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_papers_cs_cv_submitted ON papers_cs_cv(submitted_date DESC);
        
        CREATE TABLE IF NOT EXISTS papers_cs_hc (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          authors TEXT NOT NULL,
          categories TEXT NOT NULL,
          primary_category TEXT,
          abstract TEXT,
          submitted_date TEXT NOT NULL,
          announce_date TEXT,
          scraped_date TEXT NOT NULL,
          pdf_url TEXT,
          code_url TEXT,
          project_url TEXT,
          comments TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_papers_cs_hc_submitted ON papers_cs_hc(submitted_date DESC);
        
        CREATE TABLE IF NOT EXISTS papers_cs_gr (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          authors TEXT NOT NULL,
          categories TEXT NOT NULL,
          primary_category TEXT,
          abstract TEXT,
          submitted_date TEXT NOT NULL,
          announce_date TEXT,
          scraped_date TEXT NOT NULL,
          pdf_url TEXT,
          code_url TEXT,
          project_url TEXT,
          comments TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_papers_cs_gr_submitted ON papers_cs_gr(submitted_date DESC);
    """)
    
    cursor.executescript("""
        -- FTS5 Tables
        CREATE VIRTUAL TABLE IF NOT EXISTS papers_cs_cv_fts USING fts5(
          title, 
          abstract, 
          authors, 
          content=papers_cs_cv, 
          content_rowid=rowid,
          tokenize='porter unicode61'
        );
        
        CREATE VIRTUAL TABLE IF NOT EXISTS papers_cs_hc_fts USING fts5(
          title, 
          abstract, 
          authors,
          content=papers_cs_hc,
          content_rowid=rowid,
          tokenize='porter unicode61'
        );
        
        CREATE VIRTUAL TABLE IF NOT EXISTS papers_cs_gr_fts USING fts5(
          title, 
          abstract, 
          authors, 
          content=papers_cs_gr, 
          content_rowid=rowid,
          tokenize='porter unicode61'
        );
    """)
    
    cursor.executescript("""
        -- Triggers for papers_cs_cv
        DROP TRIGGER IF EXISTS papers_cs_cv_ai;
        CREATE TRIGGER papers_cs_cv_ai AFTER INSERT ON papers_cs_cv BEGIN
          INSERT INTO papers_cs_cv_fts(rowid, title, abstract, authors)
          VALUES (new.rowid, new.title, new.abstract, new.authors);
        END;
        
        DROP TRIGGER IF EXISTS papers_cs_cv_ad;
        CREATE TRIGGER papers_cs_cv_ad AFTER DELETE ON papers_cs_cv BEGIN
          DELETE FROM papers_cs_cv_fts WHERE rowid = old.rowid;
        END;
        
        DROP TRIGGER IF EXISTS papers_cs_cv_au;
        CREATE TRIGGER papers_cs_cv_au AFTER UPDATE ON papers_cs_cv BEGIN
          UPDATE papers_cs_cv_fts 
          SET title = new.title, abstract = new.abstract, authors = new.authors
          WHERE rowid = new.rowid;
        END;
        
        -- Triggers for papers_cs_hc
        DROP TRIGGER IF EXISTS papers_cs_hc_ai;
        CREATE TRIGGER papers_cs_hc_ai AFTER INSERT ON papers_cs_hc BEGIN
          INSERT INTO papers_cs_hc_fts(rowid, title, abstract, authors)
          VALUES (new.rowid, new.title, new.abstract, new.authors);
        END;
        
        DROP TRIGGER IF EXISTS papers_cs_hc_ad;
        CREATE TRIGGER papers_cs_hc_ad AFTER DELETE ON papers_cs_hc BEGIN
          DELETE FROM papers_cs_hc_fts WHERE rowid = old.rowid;
        END;
        
        DROP TRIGGER IF EXISTS papers_cs_hc_au;
        CREATE TRIGGER papers_cs_hc_au AFTER UPDATE ON papers_cs_hc BEGIN
          UPDATE papers_cs_hc_fts 
          SET title = new.title, abstract = new.abstract, authors = new.authors
          WHERE rowid = new.rowid;
        END;
        
        -- Triggers for papers_cs_gr
        DROP TRIGGER IF EXISTS papers_cs_gr_ai;
        CREATE TRIGGER papers_cs_gr_ai AFTER INSERT ON papers_cs_gr BEGIN
          INSERT INTO papers_cs_gr_fts(rowid, title, abstract, authors)
          VALUES (new.rowid, new.title, new.abstract, new.authors);
        END;
        
        DROP TRIGGER IF EXISTS papers_cs_gr_ad;
        CREATE TRIGGER papers_cs_gr_ad AFTER DELETE ON papers_cs_gr BEGIN
          DELETE FROM papers_cs_gr_fts WHERE rowid = old.rowid;
        END;
        
        DROP TRIGGER IF EXISTS papers_cs_gr_au;
        CREATE TRIGGER papers_cs_gr_au AFTER UPDATE ON papers_cs_gr BEGIN
          UPDATE papers_cs_gr_fts 
          SET title = new.title, abstract = new.abstract, authors = new.authors
          WHERE rowid = new.rowid;
        END;
    """)
    
    conn.commit()


def transfer_papers(source_db: Path, target_conn: sqlite3.Connection, target_table: str, category: str, batch_size: int = 10000):
    """Transfer papers from source database to target table."""
    source_conn = sqlite3.connect(str(source_db))
    source_conn.row_factory = sqlite3.Row
    source_cursor = source_conn.cursor()
    
    target_cursor = target_conn.cursor()
    
    source_cursor.execute("SELECT COUNT(*) as count FROM papers")
    total_papers = source_cursor.fetchone()['count']
    
    print(f"  Transferring {total_papers:,} papers to {target_table}...", file=sys.stderr)
    
    offset = 0
    transferred = 0
    
    while True:
        source_cursor.execute("SELECT * FROM papers LIMIT ? OFFSET ?", (batch_size, offset))
        batch = source_cursor.fetchall()
        
        if not batch:
            break
        
        for paper in batch:
            try:
                paper_dict = dict(paper)
                target_cursor.execute(f"""
                    INSERT OR REPLACE INTO {target_table} (
                        id, title, authors, categories, primary_category,
                        abstract, submitted_date, announce_date, scraped_date,
                        pdf_url, code_url, project_url, comments, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    paper_dict['id'],
                    paper_dict['title'],
                    paper_dict['authors'],
                    paper_dict['categories'],
                    paper_dict.get('primary_category'),
                    paper_dict.get('abstract'),
                    paper_dict['submitted_date'],
                    paper_dict.get('announce_date'),
                    paper_dict['scraped_date'],
                    paper_dict.get('pdf_url'),
                    paper_dict.get('code_url'),
                    paper_dict.get('project_url'),
                    paper_dict.get('comments'),
                    paper_dict.get('created_at')
                ))
                transferred += 1
            except Exception as e:
                paper_id = dict(paper).get('id', 'unknown') if hasattr(paper, 'keys') else 'unknown'
                print(f"  Warning: Failed to transfer {paper_id}: {e}", file=sys.stderr)
        
        target_conn.commit()
        offset += batch_size
        
        progress_pct = (transferred / total_papers * 100) if total_papers > 0 else 0
        print(f"  [{target_table}] {transferred:,}/{total_papers:,} ({progress_pct:.1f}%)", file=sys.stderr)
        
        if len(batch) < batch_size:
            break
    
    source_conn.close()
    return transferred


def build_local_debug_db(output_path: Path = None, batch_size: int = 10000):
    """
    Build a local development database from filtered category databases.
    
    Args:
        output_path: Path to output dev.db file (default: project_root/dev.db)
        batch_size: Number of papers to process at a time
    """
    project_root = Path(__file__).parent.parent.parent
    pipeline_dir = Path(__file__).parent.parent
    
    if output_path is None:
        output_path = project_root / "dev.db"
    
    print(f"\nBuild Local Debug Database", file=sys.stderr)
    print(f"{'='*60}", file=sys.stderr)
    print(f"Output:     {output_path}", file=sys.stderr)
    print(f"Batch size: {batch_size:,} papers", file=sys.stderr)
    
    if output_path.exists():
        print(f"\n  Warning: Output database exists, will be overwritten", file=sys.stderr)
        output_path.unlink()
    
    print(f"\nCreating database schema...", file=sys.stderr)
    conn = sqlite3.connect(str(output_path))
    create_production_schema(conn)
    
    category_mapping = get_category_mapping()
    total_transferred = 0
    
    for filtered_db_name, (category, table_name) in category_mapping.items():
        filtered_db = pipeline_dir / f"{filtered_db_name}.db"
        
        if not filtered_db.exists():
            print(f"\n  Skipping {filtered_db_name}.db (not found)", file=sys.stderr)
            continue
        
        print(f"\n{'='*60}", file=sys.stderr)
        print(f"Processing: {filtered_db.name}", file=sys.stderr)
        print(f"  Category: {category}", file=sys.stderr)
        print(f"  Table:    {table_name}", file=sys.stderr)
        print(f"{'='*60}", file=sys.stderr)
        
        transferred = transfer_papers(filtered_db, conn, table_name, category, batch_size)
        total_transferred += transferred
        print(f"  ✓ Transferred {transferred:,} papers to {table_name}", file=sys.stderr)
    
    cursor = conn.cursor()
    
    stats = {}
    for _, (_, table_name) in category_mapping.items():
        cursor.execute(f"SELECT COUNT(*) as count FROM {table_name}")
        count = cursor.fetchone()[0]
        stats[table_name] = count
    
    cursor.execute("SELECT COUNT(*) as count FROM figures")
    stats['figures'] = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) as count FROM access_keys")
    stats['access_keys'] = cursor.fetchone()[0]
    
    print(f"\n{'='*60}", file=sys.stderr)
    print(f"Summary", file=sys.stderr)
    print(f"{'='*60}", file=sys.stderr)
    for table, count in stats.items():
        print(f"  {table}: {count:,} rows", file=sys.stderr)
    print(f"\n✓ Complete! Database saved to: {output_path}", file=sys.stderr)
    
    wrangler_d1_dir = project_root / ".wrangler" / "state" / "v3" / "d1" / "miniflare-D1DatabaseObject"
    
    print(f"\nLooking for wrangler local database to update...", file=sys.stderr)
    wrangler_db_found = False
    
    if wrangler_d1_dir.exists():
        sqlite_files = list(wrangler_d1_dir.rglob("*.sqlite"))
        sqlite_files.extend(list(wrangler_d1_dir.rglob("*.db")))
        
        if sqlite_files:
            wrangler_db_path = max(sqlite_files, key=lambda p: p.stat().st_mtime)
            try:
                shutil.copy2(output_path, wrangler_db_path)
                print(f"  ✓ Updated wrangler local database: {wrangler_db_path}", file=sys.stderr)
                wrangler_db_found = True
            except Exception as e:
                print(f"  Warning: Could not update wrangler database: {e}", file=sys.stderr)
    
    if not wrangler_db_found:
        print(f"  Note: Wrangler local database not found yet", file=sys.stderr)
        print(f"        It will be created when you run 'wrangler pages dev --local'", file=sys.stderr)
    
    conn.close()


if __name__ == "__main__":
    output_path = None
    if len(sys.argv) > 1:
        output_path = Path(sys.argv[1])
    
    build_local_debug_db(output_path)
