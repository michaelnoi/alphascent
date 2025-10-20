"""
Process figures from arXiv papers: extract, classify, downsample, and save.

This module orchestrates the full pipeline from PDF to stored figure images.
"""

import sys
import io
from pathlib import Path
from typing import Dict, Optional, List

from PIL import Image

from extract_figures import download_pdf, extract_images
from classify_figures import classify_figures


def downsample_for_vlm(img_bytes: bytes, max_width: int = 512, quality: int = 75) -> bytes:
    """
    Aggressively downsample image for VLM to save tokens while keeping it discernible.
    
    Args:
        img_bytes: Raw image bytes
        max_width: Maximum width in pixels (default 512 for token efficiency)
        quality: JPEG quality (default 75 for smaller size)
        
    Returns:
        Downsampled image bytes
    """
    img = Image.open(io.BytesIO(img_bytes))
    
    if img.width > max_width:
        ratio = max_width / img.width
        new_height = int(img.height * ratio)
        img = img.resize((max_width, new_height), Image.LANCZOS)
    
    if img.mode not in ('RGB', 'L'):
        if img.mode == 'CMYK':
            img = img.convert('RGB')
        elif img.mode in ('RGBA', 'LA'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1])
            img = background
        elif img.mode == 'P':
            img = img.convert('RGB')
        else:
            img = img.convert('RGB')
    
    output = io.BytesIO()
    img.save(output, format='JPEG', quality=quality, optimize=True)
    return output.getvalue()


def downsample_image(img_bytes: bytes, max_width: int = 800, quality: int = 80) -> bytes:
    """
    Resize image maintaining aspect ratio and convert to WebP (60-80% smaller than PNG).
    
    Args:
        img_bytes: Raw image bytes
        max_width: Maximum width in pixels
        quality: WebP quality (1-100, default 80)
        
    Returns:
        Downsampled image as WebP bytes
    """
    img = Image.open(io.BytesIO(img_bytes))
    
    if img.width > max_width:
        ratio = max_width / img.width
        new_height = int(img.height * ratio)
        img = img.resize((max_width, new_height), Image.LANCZOS)
    
    # Convert to RGB (WebP doesn't support CMYK, etc.)
    if img.mode not in ('RGB', 'L'):
        if img.mode == 'CMYK':
            img = img.convert('RGB')
        elif img.mode in ('RGBA', 'LA'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1])
            img = background
        elif img.mode == 'P':
            img = img.convert('RGB')
        else:
            img = img.convert('RGB')
    
    # Save as WebP with high quality compression
    output = io.BytesIO()
    img.save(output, format='WEBP', quality=quality, method=6)  # method=6 = best compression
    return output.getvalue()


def save_figure(paper_id: str, figure_type: str, img_bytes: bytes, 
                output_dir: Path = Path("public/figures")) -> Dict[str, str]:
    """
    Save figure (full + thumbnail) to filesystem and return URL paths.
    
    Args:
        paper_id: arXiv paper ID
        figure_type: 'teaser' or 'architecture'
        img_bytes: Raw image bytes
        output_dir: Base directory for storing figures
        
    Returns:
        Dict with 'full' and 'thumb' URL paths
    """
    paper_dir = output_dir / paper_id
    paper_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate full-size image (800px max, WebP quality 80)
    full_image = downsample_image(img_bytes, max_width=800, quality=80)
    full_path = paper_dir / f"{figure_type}.webp"
    with open(full_path, 'wb') as f:
        f.write(full_image)
    
    # Generate thumbnail (200px max, WebP quality 75 for smaller size)
    thumb_image = downsample_image(img_bytes, max_width=200, quality=75)
    thumb_path = paper_dir / f"{figure_type}_thumb.webp"
    with open(thumb_path, 'wb') as f:
        f.write(thumb_image)
    
    print(f"Saved {figure_type}: full={len(full_image)}B, thumb={len(thumb_image)}B", file=sys.stderr)
    
    return {
        'full': f"/figures/{paper_id}/{figure_type}.webp",
        'thumb': f"/figures/{paper_id}/{figure_type}_thumb.webp"
    }


def load_existing_figures(paper_id: str, output_dir: Path = Path("public/figures")) -> Dict[str, Dict[str, str]]:
    """
    Load existing figure paths from filesystem without reprocessing.
    
    Args:
        paper_id: arXiv paper ID
        output_dir: Base directory where figures are stored
        
    Returns:
        Dict with figure URLs: {'teaser': {'full': '...', 'thumb': '...'}, 'architecture': {...}}
    """
    figure_urls = {}
    paper_dir = output_dir / paper_id
    
    if not paper_dir.exists():
        return figure_urls
    
    teaser_full = paper_dir / "teaser.webp"
    teaser_thumb = paper_dir / "teaser_thumb.webp"
    if teaser_full.exists() and teaser_thumb.exists():
        figure_urls['teaser'] = {
            'full': f"/figures/{paper_id}/teaser.webp",
            'thumb': f"/figures/{paper_id}/teaser_thumb.webp"
        }
    
    arch_full = paper_dir / "architecture.webp"
    arch_thumb = paper_dir / "architecture_thumb.webp"
    if arch_full.exists() and arch_thumb.exists():
        figure_urls['architecture'] = {
            'full': f"/figures/{paper_id}/architecture.webp",
            'thumb': f"/figures/{paper_id}/architecture_thumb.webp"
        }
    
    return figure_urls


def process_paper_figures(paper_id: str, output_dir: Path = Path("public/figures"),
                          confidence_threshold: float = 0.5) -> Dict[str, str]:
    """
    Main pipeline: Download PDF, extract images, classify, and save best figures.
    
    Args:
        paper_id: arXiv paper ID
        output_dir: Base directory for storing figures
        confidence_threshold: Minimum confidence to accept classification
        
    Returns:
        Dict with figure URLs: {'teaser': '...', 'architecture': '...'}
    """
    figure_urls = {}
    
    try:
        print(f"\n=== Processing figures for {paper_id} ===", file=sys.stderr)
        
        pdf_path = download_pdf(paper_id)
        
        images = extract_images(pdf_path)
        
        if not images:
            print(f"No images found in {paper_id}", file=sys.stderr)
            pdf_path.unlink()
            return figure_urls
        
        print(f"Processing {len(images)} images (batch comparison)...", file=sys.stderr)
        
        # Teaser selection: Compare first 3 images
        teaser_idx = None
        if images:
            num_teaser_candidates = min(3, len(images))
            print(f"Comparing first {num_teaser_candidates} images for teaser selection...", file=sys.stderr)
            
            try:
                teaser_candidates = []
                for img in images[:num_teaser_candidates]:
                    downsampled = downsample_for_vlm(img['bytes'])
                    teaser_candidates.append({
                        'bytes': downsampled,
                        'caption': img.get('caption', '')
                    })
                    original_size = len(img['bytes'])
                    new_size = len(downsampled)
                    print(f"  Downsampled: {original_size}B → {new_size}B ({100*new_size/original_size:.1f}%)", file=sys.stderr)
                
                teaser_idx = classify_figures(teaser_candidates, task="teaser")
                print(f"  → Selected image {teaser_idx + 1} as teaser", file=sys.stderr)
                
                urls = save_figure(paper_id, 'teaser', images[teaser_idx]['bytes'], output_dir)
                figure_urls['teaser'] = urls
            except Exception as e:
                print(f"Teaser batch classification error: {e}, using first image", file=sys.stderr)
                teaser_idx = 0
                urls = save_figure(paper_id, 'teaser', images[0]['bytes'], output_dir)
                figure_urls['teaser'] = urls
        
        # Architecture selection: Compare first 4 non-teaser images
        if len(images) > 1 and teaser_idx is not None:
            # Get first 5 images excluding the teaser
            arch_image_indices = [i for i in range(min(5, len(images))) if i != teaser_idx][:4]
            
            if arch_image_indices:
                print(f"Comparing {len(arch_image_indices)} images (excluding teaser) for architecture...", file=sys.stderr)
                
                try:
                    arch_candidates = []
                    for i in arch_image_indices:
                        downsampled = downsample_for_vlm(images[i]['bytes'])
                        arch_candidates.append({
                            'bytes': downsampled,
                            'caption': images[i].get('caption', '')
                        })
                        original_size = len(images[i]['bytes'])
                        new_size = len(downsampled)
                        print(f"  Downsampled: {original_size}B → {new_size}B ({100*new_size/original_size:.1f}%)", file=sys.stderr)
                    
                    # Get relative index in arch_candidates list
                    best_arch_relative_idx = classify_figures(arch_candidates, task="architecture")
                    # Map back to original image index
                    best_arch_idx = arch_image_indices[best_arch_relative_idx]
                    print(f"  → Selected image {best_arch_idx + 1} as architecture", file=sys.stderr)
                    
                    urls = save_figure(paper_id, 'architecture', images[best_arch_idx]['bytes'], output_dir)
                    figure_urls['architecture'] = urls
                except Exception as e:
                    print(f"Architecture batch classification error: {e}, using largest non-teaser image", file=sys.stderr)
                    # Find largest image that isn't the teaser
                    candidates = [(i, img) for i, img in enumerate(images) if i != teaser_idx]
                    if candidates:
                        _, largest = max(candidates, key=lambda x: x[1]['width'] * x[1]['height'])
                        urls = save_figure(paper_id, 'architecture', largest['bytes'], output_dir)
                        figure_urls['architecture'] = urls
        
        pdf_path.unlink()
        
    except Exception as e:
        print(f"Error processing {paper_id}: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
    
    return figure_urls


def main():
    """Test the full pipeline on a single paper."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Process figures for an arXiv paper")
    parser.add_argument('arxiv_id', help='arXiv paper ID (e.g., 2410.12345)')
    parser.add_argument('--output-dir', type=Path, default=Path("public/figures"),
                        help='Output directory for figures')
    parser.add_argument('--confidence', type=float, default=0.5,
                        help='Minimum confidence threshold')
    
    args = parser.parse_args()
    
    figure_urls = process_paper_figures(args.arxiv_id, args.output_dir, args.confidence)
    
    print(f"\n=== Results ===")
    if figure_urls:
        for fig_type, url in figure_urls.items():
            print(f"{fig_type}: {url}")
    else:
        print("No figures extracted")


if __name__ == "__main__":
    main()
