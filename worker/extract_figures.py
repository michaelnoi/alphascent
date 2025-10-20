"""
Extract figures from arXiv PDFs by rendering complete figure regions.
Handles multi-panel, side-by-side, tight clusters, and tall figures.
"""

import sys
import re
from pathlib import Path
from typing import List, Dict
import io

import fitz  # PyMuPDF
from PIL import Image
import requests


def download_pdf(arxiv_id: str, output_dir: Path = Path("/tmp")) -> Path:
    """Download PDF from arXiv."""
    url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
    output_path = output_dir / f"{arxiv_id}.pdf"
    
    print(f"Downloading PDF for {arxiv_id}...", file=sys.stderr)
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    
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


def extract_images(pdf_path: Path) -> List[Dict]:
    """
    Extract complete figures by rendering page regions.
    Each page is processed independently - figures on different pages never interfere.
    """
    print(f"Extracting figures from {pdf_path}...", file=sys.stderr)
    doc = fitz.open(pdf_path)
    figures = []
    
    # Process each page independently
    for page_num, page in enumerate(doc):
        blocks = page.get_text("blocks")
        page_h = page.rect.height
        page_w = page.rect.width
        
        # Find and sort figure captions ON THIS PAGE ONLY
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
        
        # Skip page if no captions found
        if not figure_captions:
            continue
        
        # Process each caption ON THIS PAGE
        # NOTE: figure_captions only contains captions from THIS page
        # Cross-page interference is impossible - each page is independent
        for i, cap in enumerate(figure_captions):
            caption_bbox = cap['bbox']
            
            # Vertical boundaries (strictly within current page, no cross-page interference)
            # Top boundary: previous figure's caption bottom OR page top
            safe_top = figure_captions[i-1]['bbox'].y1 + 10 if i > 0 else 0
            
            # Bottom boundary: next figure's caption top OR current caption top
            # (all figures/captions are on the same page, so this is safe)
            if i < len(figure_captions) - 1:
                bottom = min(caption_bbox.y0, figure_captions[i+1]['bbox'].y0 - 10)
            else:
                bottom = caption_bbox.y0
            
            # Ensure boundaries are within page limits (redundant but explicit)
            safe_top = max(0, min(safe_top, page_h))
            bottom = max(0, min(bottom, page_h))
            
            # Tight cluster detection
            available = bottom - safe_top
            is_tight = available < 150
            
            # Conservative search (expand for tall figures later)
            top = safe_top if is_tight else max(safe_top, caption_bbox.y0 - page_h * 0.6)
            if bottom - top < 30:
                top = max(safe_top, caption_bbox.y0 - 200)
            
            # Horizontal boundaries (handles side-by-side, within this page only)
            left, right = _get_horizontal_bounds(cap, figure_captions, page_w)
            
            # Find images
            rect = fitz.Rect(left, top, right, bottom)
            images = _find_images_in_rect(page, rect, left, right)
            
            # Expand vertically if tall figure detected
            if images:
                min_top = min(r.y0 for r in images)
                if min_top < top - 20:
                    new_top = max(safe_top, min_top - 10)
                    if new_top < top - 20:
                        images = _find_images_in_rect(page, fitz.Rect(left, new_top, right, bottom), left, right)
                        top = new_top
            
            if not images:
                continue
            
            # Compute bounding box (strictly within current page)
            bbox = (min(r.y0 for r in images), max(r.y1 for r in images),
                   min(r.x0 for r in images), max(r.x1 for r in images))
            
            # Create figure rectangle with padding, clamped to page boundaries
            fig_rect = fitz.Rect(
                max(0, bbox[2] - 10), max(safe_top, bbox[0] - 10),
                min(page_w, bbox[3] + 10), min(page_h, caption_bbox.y1 + 3)
            )
            
            # Validate size
            min_h, min_w = (30, 60) if is_tight else (40, 80)
            if fig_rect.height < min_h or fig_rect.width < min_w or fig_rect.height > page_h * 0.85:
                continue
            
            # Render figure
            try:
                pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), clip=fig_rect)
                figures.append({
                    'page': page_num, 'width': pix.width, 'height': pix.height,
                    'bytes': pix.tobytes("png"), 'caption': cap['text'],
                    'caption_prefix': cap['prefix'], 'format': 'png'
                })
                note = " [tight]" if is_tight else ""
                print(f"  Page {page_num+1}: {cap['prefix']} ({pix.width}x{pix.height}){note}", file=sys.stderr)
            except Exception as e:
                print(f"  Error rendering {cap['prefix']}: {e}", file=sys.stderr)
    
    doc.close()
    filtered = [f for f in figures if f['width'] > 300 and f['height'] > 150]
    print(f"Extracted {len(figures)} figures, {len(filtered)} after filtering", file=sys.stderr)
    return filtered


def main():
    """Test the extraction pipeline on a sample paper and save figures for inspection."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Extract figures from arXiv PDFs")
    parser.add_argument('arxiv_id', help='arXiv paper ID (e.g., 2410.12345)')
    parser.add_argument('--output-dir', type=Path, default=Path("./tmp"),
                        help='Directory for temporary PDF storage')
    parser.add_argument('--save-figures', type=Path, default=Path("./extracted_figures"),
                        help='Directory to save extracted figures for inspection')
    
    args = parser.parse_args()
    
    try:
        Path(args.output_dir).mkdir(parents=True, exist_ok=True)
        pdf_path = download_pdf(args.arxiv_id, args.output_dir)
        images = extract_images(pdf_path)
        
        # Save figures for inspection
        if images:
            figures_dir = args.save_figures / args.arxiv_id
            figures_dir.mkdir(parents=True, exist_ok=True)
            
            print(f"\n=== Saving Figures ===")
            for i, img in enumerate(images):
                safe_name = re.sub(r'[^\w\s-]', '', img.get('caption_prefix', ''))
                safe_name = re.sub(r'[-\s]+', '_', safe_name)
                filename = f"{i+1:02d}_{safe_name}.png" if safe_name else f"{i+1:02d}_unknown.png"
                
                figure_path = figures_dir / filename
                img_obj = Image.open(io.BytesIO(img['bytes']))
                
                # Convert CMYK to RGB
                if img_obj.mode == 'CMYK':
                    img_obj = img_obj.convert('RGB')
                elif img_obj.mode in ('RGBA', 'LA'):
                    background = Image.new('RGB', img_obj.size, (255, 255, 255))
                    background.paste(img_obj, mask=img_obj.split()[-1])
                    img_obj = background
                elif img_obj.mode not in ('RGB', 'L'):
                    img_obj = img_obj.convert('RGB')
                
                img_obj.save(figure_path, 'PNG')
                print(f"Saved: {figure_path}")
        
        # Print summary
        print(f"\n=== Summary ===")
        print(f"Paper: {args.arxiv_id}")
        print(f"Figures: {len(images)}")
        print(f"Saved to: {args.save_figures / args.arxiv_id}")
        
        pdf_path.unlink()
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

