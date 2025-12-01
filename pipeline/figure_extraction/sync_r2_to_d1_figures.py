"""
Sync R2 figures to D1 figures table.
Scans R2 once, queries D1 once, batches inserts for minimal operations.
"""

import sys
import boto3
import subprocess
import json
from pathlib import Path
from botocore.config import Config

sys.path.append(str(Path(__file__).parent.parent))
import config


def parse_figure_key(key: str):
    """Parse 'figures/2510.14230/teaser.webp' -> (paper_id, kind, is_thumb)"""
    if not key.startswith('figures/') or key.count('/') != 2:
        return None
    _, paper_id, filename = key.split('/')
    if filename.endswith('_thumb.webp'):
        return (paper_id, filename[:-11], True)  # Remove '_thumb.webp'
    elif filename.endswith('.webp'):
        return (paper_id, filename[:-5], False)  # Remove '.webp'
    return None


def scan_r2(bucket: str) -> dict:
    """Scan R2 and return {(paper_id, kind): {'r2_key': ..., 'thumb_key': ...}}"""
    print("Scanning R2...", file=sys.stderr)
    
    s3 = boto3.client('s3',
        endpoint_url=config.R2_ENDPOINT,
        aws_access_key_id=config.R2_ACCESS_KEY,
        aws_secret_access_key=config.R2_SECRET_KEY,
        config=Config(signature_version='s3v4'),
        region_name='auto'
    )
    
    figures = {}
    paginator = s3.get_paginator('list_objects_v2')
    
    for page in paginator.paginate(Bucket=bucket, Prefix='figures/'):
        for obj in page.get('Contents', []):
            parsed = parse_figure_key(obj['Key'])
            if not parsed:
                continue
            
            paper_id, kind, is_thumb = parsed
            key = (paper_id, kind)
            
            if key not in figures:
                figures[key] = {'r2_key': None, 'thumb_key': None}
            
            figures[key]['thumb_key' if is_thumb else 'r2_key'] = obj['Key']
    
    print(f"  Found {len(figures):,} figure pairs", file=sys.stderr)
    return figures


def get_existing_figures_d1() -> dict:
    """Query D1 once for all existing figures, return {id: {'r2_key': str, 'thumb_key': str}}"""
    print("Querying D1...", file=sys.stderr)
    
    result = subprocess.run(
        ['wrangler', 'd1', 'execute', 'alphascent-db', '--remote', '--json',
         '--command', 'SELECT id, paper_id, kind, r2_key, thumb_key FROM figures'],
        capture_output=True, text=True
    )
    
    if result.returncode != 0:
        print("  Warning: Could not query D1, assuming empty", file=sys.stderr)
        return {}
    
    try:
        data = json.loads(result.stdout)
        existing = {}
        for row in data[0].get('results', []):
            figure_id = row['id']
            existing[figure_id] = {
                'paper_id': row['paper_id'],
                'kind': row['kind'],
                'r2_key': row.get('r2_key'),
                'thumb_key': row.get('thumb_key')
            }
        print(f"  Found {len(existing):,} existing figures", file=sys.stderr)
        return existing
    except Exception as e:
        print(f"  Error parsing D1 results: {e}", file=sys.stderr)
        return {}


def batch_insert_d1(inserts: list, updates: list, batch_size: int = 100):
    """Batch insert/update figures into D1 using wrangler for minimal writes"""
    total_ops = len(inserts) + len(updates)
    if total_ops == 0:
        return
    
    print(f"Processing {len(inserts):,} inserts and {len(updates):,} updates in batches...", file=sys.stderr)
    
    all_ops = inserts + updates
    for i in range(0, len(all_ops), batch_size):
        batch = all_ops[i:i + batch_size]
        
        # Build multi-row INSERT/UPDATE
        sql_lines = []
        for paper_id, kind, r2_key, thumb_key in batch:
            figure_id = f"{paper_id}-{kind}"
            thumb_val = f"'{thumb_key.replace("'", "''")}'" if thumb_key else 'NULL'
            r2_key_escaped = r2_key.replace("'", "''")
            sql_lines.append(
                f"INSERT INTO figures (id, paper_id, kind, r2_key, thumb_key, width, height) "
                f"VALUES ('{figure_id}', '{paper_id}', '{kind}', '{r2_key_escaped}', {thumb_val}, 0, 0) "
                f"ON CONFLICT(id) DO UPDATE SET "
                f"r2_key = excluded.r2_key, "
                f"thumb_key = COALESCE(excluded.thumb_key, figures.thumb_key)"
            )
        
        sql = ';\n'.join(sql_lines) + ';'
        
        # Write to temp file and execute
        temp_file = Path('/tmp/d1_batch_insert.sql')
        temp_file.write_text(sql)
        
        result = subprocess.run(
            ['wrangler', 'd1', 'execute', 'alphascent-db', '--remote', 
             '--file', str(temp_file)],
            capture_output=True, text=True
        )
        
        if result.returncode != 0:
            print(f"  ✗ Batch {i//batch_size + 1} failed: {result.stderr}", file=sys.stderr)
        else:
            print(f"  ✓ Batch {i//batch_size + 1}/{(total_ops-1)//batch_size + 1}", file=sys.stderr)
        
        temp_file.unlink(missing_ok=True)


def main():
    print("\nR2 → D1 Figures Sync", file=sys.stderr)
    print("=" * 60, file=sys.stderr)
    
    # 1. Scan R2 (one paginated read)
    figures = scan_r2(config.R2_BUCKET_NAME)
    
    # 2. Query D1 (one read)
    existing = get_existing_figures_d1()
    
    # 3. Build insert/update lists
    to_insert = []
    to_update = []
    
    for (paper_id, kind), data in figures.items():
        if not data['r2_key']:
            continue
        
        figure_id = f"{paper_id}-{kind}"
        
        if figure_id not in existing:
            # New figure - insert
            to_insert.append((paper_id, kind, data['r2_key'], data['thumb_key']))
        else:
            # Check if update needed
            existing_data = existing[figure_id]
            needs_update = False
            
            # Update if r2_key doesn't match
            if existing_data['r2_key'] != data['r2_key']:
                needs_update = True
            
            # Update if missing thumbnail and we have one
            if not existing_data['thumb_key'] and data['thumb_key']:
                needs_update = True
            
            if needs_update:
                to_update.append((paper_id, kind, data['r2_key'], data['thumb_key']))
    
    if not to_insert and not to_update:
        print("\n✓ All R2 figures already in D1 with correct keys and thumbnails!", file=sys.stderr)
        return
    
    if to_insert:
        print(f"\n{len(to_insert):,} new figures to insert", file=sys.stderr)
    if to_update:
        print(f"{len(to_update):,} existing figures to update (fixing r2_key/thumb_key)", file=sys.stderr)
    
    # 4. Batch insert/update (minimal writes)
    batch_insert_d1(to_insert, to_update)
    
    print(f"\n✓ Sync complete!", file=sys.stderr)


if __name__ == "__main__":
    main()
