"""
Process and upload figures to R2.

Converts figures to WebP and uploads to Cloudflare R2.
"""

import sys
import io
from typing import Dict

from PIL import Image
import boto3
from botocore.client import Config


def downsample_image(img_bytes: bytes, max_width: int = 800, quality: int = 80) -> bytes:
    """
    Resize image maintaining aspect ratio and convert to WebP.
    
    Args:
        img_bytes: Raw image bytes
        max_width: Maximum width in pixels
        quality: WebP quality (1-100)
        
    Returns:
        Downsampled image as WebP bytes
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
    img.save(output, format='WEBP', quality=quality, method=6)
    return output.getvalue()


def upload_to_r2(local_bytes: bytes, r2_key: str, config: Dict) -> str:
    """
    Upload file to R2.
    
    Args:
        local_bytes: File bytes to upload
        r2_key: R2 object key (e.g., 'figures/2510.15870/teaser.webp')
        config: Dict with R2 credentials
        
    Returns:
        Public URL of uploaded file
    """
    s3 = boto3.client(
        's3',
        endpoint_url=config['endpoint'],
        aws_access_key_id=config['access_key'],
        aws_secret_access_key=config['secret_key'],
        config=Config(signature_version='s3v4'),
        region_name='auto'
    )
    
    s3.put_object(
        Bucket=config['bucket_name'],
        Key=r2_key,
        Body=local_bytes,
        ContentType='image/webp'
    )
    
    return f"{config['public_url']}/{r2_key}"


def process_and_upload_figure(figure_bytes: bytes, paper_id: str, kind: str, 
                               r2_config: Dict, full_size: int = 800, 
                               thumb_size: int = 200) -> Dict:
    """
    Process figure and upload both full and thumbnail versions to R2.
    
    Args:
        figure_bytes: Raw figure bytes
        paper_id: arXiv paper ID
        kind: 'teaser' or 'architecture'
        r2_config: R2 configuration dict
        full_size: Max width for full-size image
        thumb_size: Max width for thumbnail
        
    Returns:
        Dict with r2_key, thumb_key, and URLs
    """
    full_image = downsample_image(figure_bytes, max_width=full_size, quality=80)
    thumb_image = downsample_image(figure_bytes, max_width=thumb_size, quality=75)
    
    r2_key = f"figures/{paper_id}/{kind}.webp"
    thumb_key = f"figures/{paper_id}/{kind}_thumb.webp"
    
    print(f"  Uploading {kind}: full={len(full_image)}B, thumb={len(thumb_image)}B", 
          file=sys.stderr)
    
    full_url = upload_to_r2(full_image, r2_key, r2_config)
    thumb_url = upload_to_r2(thumb_image, thumb_key, r2_config)
    
    return {
        'r2_key': r2_key,
        'thumb_key': thumb_key,
        'full_url': full_url,
        'thumb_url': thumb_url,
        'full_size': len(full_image),
        'thumb_size': len(thumb_image)
    }


def get_r2_config(config_module) -> Dict:
    """Get R2 configuration from config module."""
    return {
        'endpoint': config_module.R2_ENDPOINT,
        'access_key': config_module.R2_ACCESS_KEY,
        'secret_key': config_module.R2_SECRET_KEY,
        'bucket_name': config_module.R2_BUCKET_NAME,
        'public_url': config_module.R2_BUCKET_URL
    }
