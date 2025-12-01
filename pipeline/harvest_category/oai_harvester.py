"""OAI-PMH harvester for bulk metadata from arXiv."""

import re
import sys
from datetime import datetime
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional, Tuple

import requests

from database import PipelineDB


OAI_PMH_URL = "https://oaipmh.arxiv.org/oai"
OAI_NS = "{http://www.openarchives.org/OAI/2.0/}"
ARXIV_NS = "{http://arxiv.org/OAI/arXiv/}"


def harvest_category(category: str, from_date: Optional[str] = None, 
                     until_date: Optional[str] = None, limit: Optional[int] = None, 
                     db: Optional[PipelineDB] = None, checkpoint_interval: int = 500_000) -> List[Dict]:
    """
    Harvest papers from OAI-PMH by category with optional date range.
    
    Args:
        category: Category set (e.g., 'cs', 'physics:hep-th')
        from_date: Optional start date (YYYY-MM-DD)
        until_date: Optional end date (YYYY-MM-DD). Defaults to today if from_date is provided.
        limit: Optional limit on number of papers
        db: Optional database instance for incremental saves
        checkpoint_interval: Save to database every N papers
    """
    if from_date and not until_date:
        until_date = datetime.now().strftime('%Y-%m-%d')
    
    params = {
        'verb': 'ListRecords',
        'metadataPrefix': 'arXiv',
        'set': category
    }
    
    if from_date:
        params['from'] = from_date
    if until_date:
        params['until'] = until_date
    
    date_desc = f" ({from_date} to {until_date or from_date})" if from_date else ""
    return _harvest_common(params, limit, db, checkpoint_interval, f"category '{category}'{date_desc}")


def _harvest_common(params: Dict, limit: Optional[int], db: Optional[PipelineDB],
                    checkpoint_interval: int, description: str) -> List[Dict]:
    papers = []
    resumption_token = None
    saved_count = 0
    initial_params = params.copy()
    
    print(f"Harvesting {description} from OAI-PMH...", file=sys.stderr)
    if db:
        print(f"  Checkpointing enabled: saving every {checkpoint_interval} papers", file=sys.stderr)
    
    def save_batch(papers_to_save: List[Dict]) -> int:
        count = 0
        for paper in papers_to_save:
            try:
                db.insert_paper(paper)
                count += 1
            except Exception as e:
                print(f"  Warning: Failed to save {paper.get('id', 'unknown')}: {e}", file=sys.stderr)
        return count
    
    while True:
        params = {'verb': 'ListRecords', 'resumptionToken': resumption_token} if resumption_token else initial_params.copy()
        
        try:
            response = requests.get(OAI_PMH_URL, params=params, timeout=60)
            response.raise_for_status()
            
            records, resumption_token = parse_oai_response(response.content)
            papers.extend(records)
            
            if db and len(papers) - saved_count >= checkpoint_interval:
                saved_count += save_batch(papers[saved_count:])
                print(f"  Checkpoint: Saved {saved_count} papers to database", file=sys.stderr)
            
            print(f"  Harvested {len(papers)} papers so far...", file=sys.stderr)
            
            if limit and len(papers) >= limit:
                papers = papers[:limit]
                break
            
            if not resumption_token:
                break
                
        except Exception as e:
            print(f"  Error: {e}", file=sys.stderr)
            if db and saved_count < len(papers):
                print(f"  Saving progress before exit...", file=sys.stderr)
                saved_count += save_batch(papers[saved_count:])
                print(f"  Saved {saved_count} papers before exit", file=sys.stderr)
            break
    
    if db and saved_count < len(papers):
        print(f"  Final save: {len(papers) - saved_count} remaining papers...", file=sys.stderr)
        saved_count += save_batch(papers[saved_count:])
    
    print(f"  Total harvested: {len(papers)} papers", file=sys.stderr)
    if db:
        print(f"  Total saved to database: {saved_count} papers", file=sys.stderr)
    
    return papers


def parse_oai_response(xml_content: bytes) -> Tuple[List[Dict], Optional[str]]:
    """Parse OAI-PMH response and extract papers and resumption token."""
    root = ET.fromstring(xml_content)
    
    records = []
    list_records = root.find(f"{OAI_NS}ListRecords")
    
    if list_records is not None:
        for record in list_records.findall(f"{OAI_NS}record"):
            try:
                paper = parse_oai_record(record)
                if paper:
                    records.append(paper)
            except Exception as e:
                print(f"  Warning: Failed to parse record: {e}", file=sys.stderr)
    
    resumption_token_elem = list_records.find(f"{OAI_NS}resumptionToken") if list_records else None
    resumption_token = resumption_token_elem.text if resumption_token_elem is not None and resumption_token_elem.text else None
    
    return records, resumption_token


def extract_links_from_comments(comments: str) -> Tuple[Optional[str], Optional[str]]:
    if not comments:
        return None, None
    
    def find_url_after(pattern: str) -> Optional[str]:
        match = re.search(pattern, comments, re.IGNORECASE)
        if match:
            url_match = re.search(r'https?://[^\s<>"{}|\\^`\[\]]+', comments[match.end():])
            if url_match:
                return url_match.group(0).strip()
        return None
    
    return find_url_after(r'\bcode\b'), find_url_after(r'\bproject\s+page\b')


def parse_oai_record(record: ET.Element) -> Optional[Dict]:
    """Parse single OAI-PMH record to paper dict."""
    metadata = record.find(f"{OAI_NS}metadata/{ARXIV_NS}arXiv")
    
    if metadata is None:
        return None
    
    arxiv_id = metadata.findtext(f"{ARXIV_NS}id", "")
    if not arxiv_id:
        return None
    
    title = metadata.findtext(f"{ARXIV_NS}title", "").strip().replace("\n", " ")
    title = " ".join(title.split())
    
    authors = []
    authors_elem = metadata.find(f"{ARXIV_NS}authors")
    if authors_elem is not None:
        for author in authors_elem.findall(f"{ARXIV_NS}author"):
            keyname = author.findtext(f"{ARXIV_NS}keyname", "")
            forenames = author.findtext(f"{ARXIV_NS}forenames", "")
            if keyname:
                full_name = f"{forenames} {keyname}".strip() if forenames else keyname
                authors.append(full_name)
    
    abstract = metadata.findtext(f"{ARXIV_NS}abstract", "")
    if abstract:
        abstract = abstract.strip().replace("\n", " ")
        abstract = " ".join(abstract.split())
    
    categories_text = metadata.findtext(f"{ARXIV_NS}categories", "")
    categories = [c.strip() for c in categories_text.split() if c.strip()]
    primary_category = categories[0] if categories else None
    
    created = metadata.findtext(f"{ARXIV_NS}created", "")
    
    comments = metadata.findtext(f"{ARXIV_NS}comments", "")
    journal_ref = metadata.findtext(f"{ARXIV_NS}journal-ref", "")
    doi = metadata.findtext(f"{ARXIV_NS}doi", "")

    code_url, project_url = extract_links_from_comments(comments)
    
    return {
        'id': arxiv_id,
        'title': title,
        'authors': authors,
        'categories': categories,
        'primary_category': primary_category,
        'abstract': abstract,
        'submitted_date': created,
        'announce_date': None,
        'scraped_date': datetime.now().strftime('%Y-%m-%d'),
        'pdf_url': f'https://arxiv.org/pdf/{arxiv_id}',
        'code_url': code_url,
        'project_url': project_url,
        'comments': comments,
        'journal_ref': journal_ref,
        'doi': doi
    }
