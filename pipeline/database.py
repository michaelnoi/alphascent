"""
Local SQLite database for pipeline processing.

Architecture:
  - Each category has its own DB file (e.g., filtered_cs_CV.db, filtered_cs_HC.db)
  - All local DBs use simple 'papers' table (not category-specific)
  - Category-specific tables (papers_cs_cv) only exist in remote D1
  - Figures are stored only in R2, not locally

Provides interface for paper operations and SQL export for D1 upload.
"""

import sqlite3
import json
from pathlib import Path
from typing import Dict


class PipelineDB:
    def __init__(self, db_path: str = "pipeline/pipeline.db"):
        """
        Local SQLite database for pipeline processing.
        
        Each category has its own database file (e.g., filtered_cs_CV.db).
        All local DBs use simple 'papers' table (not category-specific).
        Category-specific tables (papers_cs_cv) only exist in D1.
        """
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row
        
    def create_tables(self):
        """Create minimal local tables for pipeline processing.
        
        Local databases use simple 'papers' table that gets converted to
        category-specific tables (papers_cs_cv, etc.) during D1 upload.
        
        Note: Figures are extracted and uploaded directly to R2, not stored locally.
        """
        cursor = self.conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS papers (
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
            )
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_papers_submitted ON papers(submitted_date DESC)
        """)
        
        self.conn.commit()
        
    def insert_paper(self, paper_data: Dict) -> str:
        """Insert paper into database."""
        cursor = self.conn.cursor()
        
        cursor.execute("""
            INSERT OR REPLACE INTO papers (
                id, title, authors, categories, primary_category,
                abstract, submitted_date, announce_date, scraped_date, pdf_url,
                code_url, project_url, comments
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            paper_data['id'],
            paper_data['title'],
            json.dumps(paper_data['authors']),
            json.dumps(paper_data['categories']),
            paper_data.get('primary_category'),
            paper_data.get('abstract'),
            paper_data['submitted_date'],
            paper_data.get('announce_date'),
            paper_data['scraped_date'],
            paper_data.get('pdf_url'),
            paper_data.get('code_url'),
            paper_data.get('project_url'),
            paper_data.get('comments')
        ))
        
        self.conn.commit()
        return paper_data['id']
    
    def get_stats(self) -> Dict:
        """Get database statistics."""
        cursor = self.conn.cursor()
        
        cursor.execute("SELECT COUNT(*) as count FROM papers")
        paper_count = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(DISTINCT scraped_date) as count FROM papers")
        date_count = cursor.fetchone()['count']
        
        return {
            'papers': paper_count,
            'dates': date_count
        }
        
    def close(self):
        """Close database connection."""
        self.conn.close()
