#!/usr/bin/env python3
"""
ArXiv API-based scraper for AlphaScent.
Uses the official arXiv API for reliable data fetching with full abstracts.
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import xml.etree.ElementTree as ET

import requests
import pytz


ARXIV_API_URL = "http://export.arxiv.org/api/query"
EASTERN_TZ = pytz.timezone("America/New_York")
ATOM_NS = "{http://www.w3.org/2005/Atom}"
ARXIV_NS = "{http://arxiv.org/schemas/atom}"


def extract_links_from_comments(comments: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Extract code and project page URLs from comment text.
    Finds the first full URL after any mention of the keyword (case-insensitive).
    Returns (code_url, project_page_url)
    """
    if not comments:
        return None, None
    
    code_url = None
    project_url = None
    
    code_match = re.search(r'(?i)\bcode\b', comments)
    if code_match:
        remaining_text = comments[code_match.end():]
        url_match = re.search(r'https?://[^\s<>"{}|\\^`\[\]]+', remaining_text)
        if url_match:
            code_url = url_match.group(0).strip()
    
    project_match = re.search(r'(?i)\bproject\s+page\b', comments)
    if project_match:
        remaining_text = comments[project_match.end():]
        url_match = re.search(r'https?://[^\s<>"{}|\\^`\[\]]+', remaining_text)
        if url_match:
            project_url = url_match.group(0).strip()
    
    return code_url, project_url


def fetch_recent_papers(category: str = "cs.CV", max_results: int = 2000) -> List[Dict]:
    params = {
        "search_query": f"cat:{category}",
        "start": 0,
        "max_results": max_results,
        "sortBy": "submittedDate",
        "sortOrder": "descending"
    }
    
    print(f"Fetching papers from arXiv API (category: {category})...", file=sys.stderr)
    
    response = requests.get(ARXIV_API_URL, params=params, timeout=60)
    response.raise_for_status()
    
    time.sleep(3)
    
    root = ET.fromstring(response.content)
    
    papers = []
    entries = root.findall(f"{ATOM_NS}entry")
    
    print(f"Found {len(entries)} entries from API", file=sys.stderr)
    
    for entry in entries:
        try:
            id_elem = entry.find(f"{ATOM_NS}id")
            arxiv_url = id_elem.text if id_elem is not None else ""
            arxiv_id = arxiv_url.split("/abs/")[-1].replace("v1", "").replace("v2", "").replace("v3", "")
            
            title_elem = entry.find(f"{ATOM_NS}title")
            title = title_elem.text.strip().replace("\n", " ") if title_elem is not None else ""
            title = " ".join(title.split())
            
            authors = []
            for author in entry.findall(f"{ATOM_NS}author"):
                name_elem = author.find(f"{ATOM_NS}name")
                if name_elem is not None and name_elem.text:
                    authors.append(name_elem.text.strip())
            
            summary_elem = entry.find(f"{ATOM_NS}summary")
            abstract = summary_elem.text.strip().replace("\n", " ") if summary_elem is not None else ""
            abstract = " ".join(abstract.split())
            
            categories = []
            primary_category = None
            
            primary_cat_elem = entry.find(f"{ARXIV_NS}primary_category")
            if primary_cat_elem is not None:
                primary_category = primary_cat_elem.get("term", "cs.CV")
                categories.append(primary_category)
            
            for cat_elem in entry.findall(f"{ATOM_NS}category"):
                cat_term = cat_elem.get("term")
                if cat_term and cat_term not in categories:
                    categories.append(cat_term)
            
            if not primary_category:
                primary_category = categories[0] if categories else "cs.CV"
            
            if category not in categories:
                continue
            
            comment_elem = entry.find(f"{ARXIV_NS}comment")
            comments = comment_elem.text.strip() if comment_elem is not None and comment_elem.text else None
            
            code_url, project_url = extract_links_from_comments(comments)
            
            updated_elem = entry.find(f"{ATOM_NS}updated")
            updated = updated_elem.text if updated_elem is not None else ""
            
            scraped_at = datetime.now(pytz.UTC).isoformat()
            
            links = {
                "abs": f"https://arxiv.org/abs/{arxiv_id}",
                "pdf": f"https://arxiv.org/pdf/{arxiv_id}"
            }
            
            if code_url:
                links["code"] = code_url
            if project_url:
                links["project_page"] = project_url
            
            paper = {
                "id": arxiv_id,
                "title": title,
                "authors": authors,
                "categories": categories,
                "primary_category": primary_category,
                "abstract": abstract,
                "links": links,
                "scraped_at": scraped_at
            }
            
            if comments:
                paper["comments"] = comments
            
            papers.append(paper)
            
        except Exception as e:
            print(f"Error parsing entry: {e}", file=sys.stderr)
            continue
    
    return papers


def filter_by_date(papers: List[Dict], target_date: str) -> List[Dict]:
    try:
        target = datetime.strptime(target_date, "%Y-%m-%d").date()
    except ValueError:
        print(f"Invalid date format: {target_date}", file=sys.stderr)
        return papers
    
    filtered = []
    for paper in papers:
        scraped_dt = datetime.fromisoformat(paper["scraped_at"].replace("Z", "+00:00"))
        paper_date = scraped_dt.astimezone(EASTERN_TZ).date()
        
        if paper_date == target:
            filtered.append(paper)
    
    return filtered


def main():
    parser = argparse.ArgumentParser(description="Scrape arXiv cs.CV via API and generate JSON")
    parser.add_argument('--date', type=str, help='Filter by date in YYYY-MM-DD format (default: today in ET)')
    parser.add_argument('--category', type=str, default='cs.CV', help='arXiv category (default: cs.CV)')
    parser.add_argument('--max-results', type=int, default=200, help='Maximum papers to fetch (default: 2000)')
    parser.add_argument('--output', type=str, help='Output directory (default: ../public/data)')
    parser.add_argument('--dry-run', action='store_true', help='Print JSON to stdout instead of writing file')
    parser.add_argument('--no-date-filter', action='store_true', help='Include all fetched papers regardless of date')
    parser.add_argument('--no-figures', action='store_true', help='Skip figure extraction (faster)')
    parser.add_argument('--figures-dir', type=str, help='Directory for figure storage (default: ../public/figures)')
    
    args = parser.parse_args()
    
    papers = fetch_recent_papers(args.category, args.max_results)
    
    if args.date is None:
        now = datetime.now(EASTERN_TZ)
        date_str = now.strftime('%Y-%m-%d')
    else:
        date_str = args.date
    
    if not args.no_date_filter:
        papers = filter_by_date(papers, date_str)
        print(f"Filtered to {len(papers)} papers for {date_str}", file=sys.stderr)
    else:
        print(f"Including all {len(papers)} papers (no date filter)", file=sys.stderr)
    
    if not args.no_figures:
        from process_figures import process_paper_figures, load_existing_figures
        
        figures_dir = Path(args.figures_dir) if args.figures_dir else Path(__file__).parent.parent / 'public' / 'figures'
        
        print(f"\nExtracting figures from {len(papers)} papers...", file=sys.stderr)
        for i, paper in enumerate(papers):
            paper_id = paper['id']
            paper_figures_dir = figures_dir / paper_id
            
            if paper_figures_dir.exists():
                print(f"\nSkipping figures {i+1}/{len(papers)}: {paper_id} (already exists)", file=sys.stderr)
                existing_figures = load_existing_figures(paper_id, figures_dir)
                paper['links']['figures'] = existing_figures
            else:
                print(f"\nProcessing figures {i+1}/{len(papers)}: {paper_id}", file=sys.stderr)
                
                try:
                    figure_urls = process_paper_figures(paper_id, output_dir=figures_dir)
                    paper['links']['figures'] = figure_urls if figure_urls else {}
                except Exception as e:
                    print(f"Error processing figures for {paper_id}: {e}", file=sys.stderr)
                    paper['links']['figures'] = {}
        
        print(f"\nFigure extraction complete", file=sys.stderr)
    else:
        for paper in papers:
            paper['links']['figures'] = {}
    
    data = {
        "date": date_str,
        "source": f"{ARXIV_API_URL}?search_query=cat:{args.category}",
        "papers": papers
    }
    
    if args.dry_run:
        print(json.dumps(data, indent=2, ensure_ascii=False))
        return
    
    output_dir = Path(args.output) if args.output else Path(__file__).parent.parent / 'public' / 'data'
    output_dir.mkdir(parents=True, exist_ok=True)
    
    filename = f"papers-{date_str}.json"
    output_path = output_dir / filename
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"Wrote {len(papers)} papers to {output_path}", file=sys.stderr)


if __name__ == '__main__':
    main()

