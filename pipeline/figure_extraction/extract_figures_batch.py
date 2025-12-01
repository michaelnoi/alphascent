"""Extract figures for D1 papers and upload to R2."""

import sys
import io
from pathlib import Path
from contextlib import redirect_stderr
from typing import Dict, Optional, Set, Tuple
from multiprocessing import Pool

import requests
import tyro
from tqdm import tqdm

from extract_figures import download_pdf, extract_figures, select_figures_simple
from process_figures import process_and_upload_figure, get_r2_config

sys.path.append(str(Path(__file__).parent.parent))
import config
from d1_client import D1Client


FAILED_EXTRACTIONS_FILE = Path("pipeline/failed_extractions.txt")  # TODO: find better solution for failed extractions


class ServiceUnavailableError(RuntimeError):
    """Raised when upstream responds with HTTP 503 (rate limiting)."""


def load_failed_extractions() -> Set[str]:
    """Return paper IDs that previously failed extraction."""
    if not FAILED_EXTRACTIONS_FILE.exists():
        return set()
    
    with open(FAILED_EXTRACTIONS_FILE) as f:
        return {line.strip() for line in f if line.strip()}


def mark_failed_extraction(paper_id: str):
    """Record that a paper failed extraction."""
    FAILED_EXTRACTIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    with open(FAILED_EXTRACTIONS_FILE, 'a') as f:
        f.write(f"{paper_id}\n")


def get_d1_config(config_module) -> Dict:
    """Get D1 configuration from config module."""
    return {
        'account_id': config_module.CLOUDFLARE_ACCOUNT_ID,
        'database_id': config_module.D1_DATABASE_ID,
        'api_token': config_module.D1_API_TOKEN
    }


def process_paper(args_tuple: Tuple[str, Dict, Dict, bool]) -> Dict:
    """Worker function: download PDF, extract figures, select, and upload to R2. Returns result dict."""
    paper_id, r2_config, d1_config, verbose = args_tuple
    
    result = {
        'paper_id': paper_id,
        'success': False,
        'figures_uploaded': 0,
        'error': None
    }
    
    try:
        d1 = D1Client(d1_config)
        
        stderr_target = sys.stderr if verbose else io.StringIO()
        
        if verbose:
            print(f"[{paper_id}] Downloading PDF...", file=sys.stderr)
        with redirect_stderr(stderr_target):
            pdf_path = download_pdf(paper_id)
        
        if verbose:
            print(f"[{paper_id}] Extracting figures...", file=sys.stderr)
        with redirect_stderr(stderr_target):
            figures = extract_figures(pdf_path)
        
        with redirect_stderr(stderr_target):
            teaser, architecture = select_figures_simple(
                figures,
                min_width=config.FIGURE_MIN_WIDTH,
                min_height=config.FIGURE_MIN_HEIGHT
            )
        
        if not teaser and not architecture:
            mark_failed_extraction(paper_id)
            pdf_path.unlink()
            result['error'] = 'No figures'
            if verbose:
                print(f"[{paper_id}] No figures found", file=sys.stderr)
            else:
                print(f"{paper_id} ... failed due to: No figures", file=sys.stderr)
            return result
        
        if teaser:
            if verbose:
                print(f"[{paper_id}] Processing teaser...", file=sys.stderr)
            with redirect_stderr(stderr_target):
                teaser_data = process_and_upload_figure(
                    teaser['bytes'], paper_id, 'teaser', r2_config,
                    full_size=config.FIGURE_FULL_SIZE,
                    thumb_size=config.FIGURE_THUMB_SIZE
                )
            
            d1.insert_figure(
                paper_id, 'teaser',
                teaser_data['r2_key'], teaser_data['thumb_key'],
                teaser['width'], teaser['height']
            )
            result['figures_uploaded'] += 1
        
        if architecture:
            if verbose:
                print(f"[{paper_id}] Processing architecture...", file=sys.stderr)
            with redirect_stderr(stderr_target):
                arch_data = process_and_upload_figure(
                    architecture['bytes'], paper_id, 'architecture', r2_config,
                    full_size=config.FIGURE_FULL_SIZE,
                    thumb_size=config.FIGURE_THUMB_SIZE
                )
            
            d1.insert_figure(
                paper_id, 'architecture',
                arch_data['r2_key'], arch_data['thumb_key'],
                architecture['width'], architecture['height']
            )
            result['figures_uploaded'] += 1
        
        pdf_path.unlink()
        result['success'] = True
        if verbose:
            print(f"[{paper_id}] ✓ Complete ({result['figures_uploaded']} figures)", file=sys.stderr)
        
    except requests.HTTPError as e:
        if e.response is not None and e.response.status_code == 503:
            raise ServiceUnavailableError("Received HTTP 503 from arXiv/R2") from e
        result['error'] = str(e)
        mark_failed_extraction(paper_id)
        print(f"{paper_id} ... failed due to HTTP error: {e}", file=sys.stderr)
    except Exception as e:
        result['error'] = str(e)
        mark_failed_extraction(paper_id)
        if verbose:
            print(f"[{paper_id}] ✗ Error: {e}", file=sys.stderr)
        else:
            print(f"{paper_id} ... failed due to: {e}", file=sys.stderr)
    
    return result


def main(
    category: str,
    max_count: int = 100,
    workers: int = config.MAX_WORKERS,
    paper_id: Optional[str] = None,
    verbose: bool = False,
) -> None:
    info = lambda msg="": print(msg, file=sys.stderr)

    info("\nExtract Figures (D1)")
    info("=" * 60)
    info(f"Category:     {category}")
    info(f"Workers:      {workers}")
    info(f"Max count:    {max_count}")
    info(f"Failed file:  {FAILED_EXTRACTIONS_FILE}")

    d1_config = get_d1_config(config)
    r2_config = get_r2_config(config)

    if paper_id:
        info("\nMode: Single paper test")
        info(f"Paper: {paper_id}")
        paper_ids = [paper_id]
    else:
        d1 = D1Client(d1_config)
        info(f"\nQuerying D1 for {category} papers without figures...")
        paper_ids_all = d1.get_papers_needing_figures(category=category, limit=max_count * 2)
        info(f"  Found {len(paper_ids_all)} papers without figures")

        info("\nLoading failed extractions...")
        failed_set = load_failed_extractions()
        info(f"  {len(failed_set)} papers previously failed")

        paper_ids = [p for p in paper_ids_all if p not in failed_set][:max_count]
        info(f"  {len(paper_ids)} papers to process")

    if not paper_ids:
        info("\n✓ No papers to process")
        return

    info(f"\nProcessing {len(paper_ids)} papers...")
    worker_args = [(paper_id, r2_config, d1_config, verbose) for paper_id in paper_ids]
    
    def collect(iterable, pool: Optional[Pool] = None) -> list:
        results_local = []
        try:
            for item in iterable:
                results_local.append(item)
        except ServiceUnavailableError as exc:
            info("\nHTTP 503 received. Stopping all workers...")
            if pool is not None:
                pool.terminate()
                pool.join()
            raise SystemExit(str(exc)) from exc
        return results_local

    if workers > 1:
        with Pool(workers) as pool:
            iterator = pool.imap(process_paper, worker_args)
            if not verbose:
                iterator = tqdm(iterator, total=len(worker_args), desc="Processing papers", unit="paper")
            results = collect(iterator, pool)
    else:
        iterator = worker_args if verbose else tqdm(worker_args, desc="Processing papers", unit="paper")

        def sequential():
            for arg in iterator:
                yield process_paper(arg)

        results = collect(sequential())

    successful = [r for r in results if r['success']]
    failed = [r for r in results if not r['success']]
    total_figures = sum(r['figures_uploaded'] for r in results)

    info(f"\n{'=' * 60}\nSummary\n{'=' * 60}")
    info(f"Processed:  {len(successful)}/{len(results)} papers")
    info(f"Figures:    {total_figures} uploaded")

    if failed:
        info(f"Failed:     {len(failed)} papers")
        for r in failed[:5]:
            info(f"  • {r['paper_id']}: {r['error']}")

    info("\n✓ Complete!")


if __name__ == "__main__":
    tyro.cli(main)
