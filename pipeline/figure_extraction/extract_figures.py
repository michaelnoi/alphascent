"""
Extract figures from arXiv PDFs.

Adapted from worker/extract_figures.py with simplified figure selection.
"""

import sys
import re
import tempfile
import time
from pathlib import Path
from typing import List, Dict, Optional, Tuple

import fitz
import requests
import tyro
# TODO: replace by object detection model trained on academic papers

sys.path.append(str(Path(__file__).parent.parent))
import config


_last_pdf_download = 0
PDF_MIN_INTERVAL = config.ARXIV_RATE_LIMIT


def download_pdf(arxiv_id: str, output_dir: Optional[Path] = None) -> Path:
    """Download PDF from arXiv with rate limiting."""
    global _last_pdf_download
    
    if output_dir is None:
        output_dir = Path(tempfile.gettempdir())
    
    url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
    output_path = output_dir / f"{arxiv_id}.pdf"
    
    elapsed = time.time() - _last_pdf_download
    if elapsed < PDF_MIN_INTERVAL:
        wait = PDF_MIN_INTERVAL - elapsed
        print(f"  Rate limiting: waiting {wait:.1f}s...", file=sys.stderr)
        time.sleep(wait)
    
    print(f"Downloading PDF for {arxiv_id}...", file=sys.stderr)
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    
    _last_pdf_download = time.time()
    
    with open(output_path, 'wb') as f:
        f.write(response.content)
    
    return output_path


def _find_images_in_rect(page, rect, left, right) -> List:
    """Find images whose centers are within the given rectangle and horizontal bounds."""
    images = []
    for img in page.get_images():
        try:
            img_rects = page.get_image_rects(img[0])
            if img_rects:
                for bbox in img_rects:
                    if bbox.intersects(rect):
                        cy = (bbox.y0 + bbox.y1) / 2
                        cx = (bbox.x0 + bbox.x1) / 2
                        if rect.y0 <= cy <= rect.y1 and left <= cx <= right:
                            images.append(bbox)
        except:
            continue
    return images


def _get_horizontal_bounds(caption_info, figure_captions, page_width) -> tuple:
    """Determine horizontal search boundaries for side-by-side figures."""
    caption_bbox = caption_info['bbox']
    captions_same_row = [c for c in figure_captions 
                         if abs(c['y'] - caption_info['y']) < 50 and c != caption_info]
    
    if captions_same_row:
        all_in_row = sorted([caption_info] + captions_same_row, 
                           key=lambda c: (c['bbox'].x0 + c['bbox'].x1) / 2)
        idx = all_in_row.index(caption_info)
        left = all_in_row[idx - 1]['bbox'].x1 + 20 if idx > 0 else 0
        right = all_in_row[idx + 1]['bbox'].x0 - 20 if idx < len(all_in_row) - 1 else page_width
    else:
        margin = max(50, (caption_bbox.x1 - caption_bbox.x0) * 0.3)
        left = max(0, caption_bbox.x0 - margin)
        right = min(page_width, caption_bbox.x1 + margin)
    
    return left, right


def extract_figures(pdf_path: Path) -> List[Dict]:
    """
    Extract complete figures by rendering page regions.
    """
    print(f"Extracting figures from {pdf_path}...", file=sys.stderr)
    doc = fitz.open(pdf_path)
    figures = []
    
    for page_num, page in enumerate(doc):
        blocks = page.get_text("blocks")
        page_h = page.rect.height
        page_w = page.rect.width
        
        figure_captions = []
        for block in blocks:
            if len(block) >= 5:
                text = str(block[4]).strip()
                match = re.match(r'^\s*(Figure|Fig\.?)\s+\d+', text, re.IGNORECASE)
                if match:
                    bbox = fitz.Rect(block[:4])
                    figure_captions.append({
                        'text': text[:200], 'prefix': match.group(0).strip(),
                        'bbox': bbox, 'y': bbox.y0
                    })
        figure_captions.sort(key=lambda x: x['y'])
        
        if not figure_captions:
            continue
        
        for i, cap in enumerate(figure_captions):
            caption_bbox = cap['bbox']
            
            safe_top = figure_captions[i-1]['bbox'].y1 + 10 if i > 0 else 0
            
            if i < len(figure_captions) - 1:
                bottom = min(caption_bbox.y0, figure_captions[i+1]['bbox'].y0 - 10)
            else:
                bottom = caption_bbox.y0
            
            safe_top = max(0, min(safe_top, page_h))
            bottom = max(0, min(bottom, page_h))
            
            available = bottom - safe_top
            is_tight = available < 150
            
            top = safe_top if is_tight else max(safe_top, caption_bbox.y0 - page_h * 0.6)
            if bottom - top < 30:
                top = max(safe_top, caption_bbox.y0 - 200)
            
            left, right = _get_horizontal_bounds(cap, figure_captions, page_w)
            
            rect = fitz.Rect(left, top, right, bottom)
            images = _find_images_in_rect(page, rect, left, right)
            
            if images:
                min_top = min(r.y0 for r in images)
                if min_top < top - 20:
                    new_top = max(safe_top, min_top - 10)
                    if new_top < top - 20:
                        images = _find_images_in_rect(page, fitz.Rect(left, new_top, right, bottom), left, right)
                        top = new_top
            
            if not images:
                continue
            
            bbox = (min(r.y0 for r in images), max(r.y1 for r in images),
                   min(r.x0 for r in images), max(r.x1 for r in images))
            
            fig_rect = fitz.Rect(
                max(0, bbox[2] - 10), max(safe_top, bbox[0] - 10),
                min(page_w, bbox[3] + 10), min(page_h, caption_bbox.y1 + 3)
            )
            
            min_h, min_w = (30, 60) if is_tight else (40, 80)
            if fig_rect.height < min_h or fig_rect.width < min_w or fig_rect.height > page_h * 0.85:
                continue
            
            try:
                pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), clip=fig_rect)
                figures.append({
                    'page': page_num,
                    'width': pix.width,
                    'height': pix.height,
                    'bytes': pix.tobytes("png"),
                    'caption': cap['text'],
                    'caption_prefix': cap['prefix'],
                    'format': 'png'
                })
                note = " [tight]" if is_tight else ""
                print(f"  Page {page_num+1}: {cap['prefix']} ({pix.width}x{pix.height}){note}", file=sys.stderr)
            except Exception as e:
                print(f"  Error rendering {cap['prefix']}: {e}", file=sys.stderr)
    
    doc.close()
    filtered = [f for f in figures if f['width'] > 300 and f['height'] > 150]
    print(f"Extracted {len(figures)} figures, {len(filtered)} after filtering", file=sys.stderr)
    return filtered


def select_figures_simple(figures: List[Dict], 
                          min_width: int = 400, 
                          min_height: int = 200) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Simple figure selection: First valid = teaser, second = architecture.
    
    This is the fallback strategy. Future: integrate Qwen3-VL via vLLM.
    
    Args:
        figures: List of extracted figures
        min_width: Minimum width in pixels
        min_height: Minimum height in pixels
        
    Returns:
        (teaser_figure, architecture_figure) tuple
    """
    valid = [f for f in figures if f['width'] >= min_width and f['height'] >= min_height]
    
    teaser = valid[0] if len(valid) >= 1 else None
    architecture = valid[1] if len(valid) >= 2 else None
    
    if teaser:
        print(f"Selected teaser: {teaser['width']}x{teaser['height']} from page {teaser['page']+1}", 
              file=sys.stderr)
    if architecture:
        print(f"Selected architecture: {architecture['width']}x{architecture['height']} from page {architecture['page']+1}", 
              file=sys.stderr)
    
    return teaser, architecture


def select_figures_vlm(figures: List[Dict]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    TODO: Intelligent figure selection using Qwen3-VL via vLLM.
    
    Future implementation:
    - Batch process multiple papers for efficiency
    - Use local vLLM server endpoint
    - Fallback to simple selection on error
    
    TODO: Add --reprocess-figures mode to orchestrator.py
    - Query existing papers from database by date range
    - Re-extract figures using this vLLM selection
    - Update figures in DB (INSERT OR REPLACE)
    - Overwrite old figures in R2
    
    For now, this just calls the simple selection.
    """
    return select_figures_simple(figures)


def main(arxiv_id: str, save_dir: Optional[Path] = None) -> None:
    pdf_path = download_pdf(arxiv_id)
    figures = extract_figures(pdf_path)
    teaser, arch = select_figures_simple(figures)

    print(f"\nExtracted {len(figures)} figures")
    if teaser:
        print(f"Teaser: {teaser['width']}x{teaser['height']}")
    if arch:
        print(f"Architecture: {arch['width']}x{arch['height']}")

    if save_dir:
        save_dir.mkdir(parents=True, exist_ok=True)
        for idx, fig in enumerate(figures, start=1):
            img = fig.get("image")
            if img is not None:
                img.save(save_dir / f"{arxiv_id}_fig_{idx}.png")

    pdf_path.unlink()


if __name__ == "__main__":
    tyro.cli(main)
