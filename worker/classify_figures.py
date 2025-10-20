"""
Classify figures using Google Gemini 2.5 Flash Image API via Vertex AI.

This module uses ML-based classification to identify teaser and architecture
figures from computer vision papers.
"""

import sys
import os
import json
from typing import Dict, List
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load environment variables from .env.local
env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(env_path)

def classify_figures(images_data: List[Dict], task: str = "teaser") -> int:
    """
    Compare multiple images at once to pick the best one.
    
    Args:
        images_data: List of dicts with 'bytes' and 'caption' keys
        task: Either "teaser" or "architecture"
        
    Returns:
        Index (0-based) of the best image for the task
        
    Raises:
        Exception: If API call fails or response cannot be parsed
    """
    client = genai.Client(
        vertexai=True,
        api_key=os.environ.get("GOOGLE_CLOUD_API_KEY"),
    )
    
    if task == "teaser":
        task_desc = """a TEASER figure - an overview diagram showing the full method/approach or headline results or a cool demo of the method. 
This is typically the first main figure in the paper that gives a high-level view of the proposed method.

Note: In most papers, Figure 1 is the teaser unless another figure is clearly more comprehensive."""
    else:
        task_desc = """an ARCHITECTURE figure - a neural network diagram showing layers, blocks, or model structure.
This should clearly show the technical architecture details with components, connections, and flow.

Note: In most papers, Figure 2 is often the architecture diagram unless another figure shows clearer a technical overview."""
    
    prompt_text = f"""I'm showing you {len(images_data)} figures from a computer vision research paper.

Your task: Pick the BEST image for {task_desc}

Images are numbered 1-{len(images_data)} in the order they appear in the paper.

Compare all images side-by-side and return:
- The image number (1-{len(images_data)}) that is BEST for this task
- Your confidence (0.0-1.0)
- Brief reasoning

Return ONLY valid JSON:
{{"image_number": 1-{len(images_data)}, "confidence": 0.0-1.0, "reasoning": "brief explanation"}}"""
    
    parts = [types.Part.from_text(text=prompt_text)]
    
    for i, img_data in enumerate(images_data):
        parts.append(types.Part.from_bytes(
            data=img_data['bytes'],
            mime_type="image/jpeg"
        ))
        if img_data.get('caption'):
            parts.append(types.Part.from_text(text=f"Image {i+1} caption: {img_data['caption']}"))
    
    contents = [types.Content(role="user", parts=parts)]
    
    config = types.GenerateContentConfig(
        temperature=0.1,
        top_p=0.95,
        max_output_tokens=1000,
        response_modalities=["TEXT"],
    )
    
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config=config,
    )
    
    response_text = response.text.strip()
    
    if "```json" in response_text:
        response_text = response_text.split("```json")[1].split("```")[0].strip()
    elif "```" in response_text:
        response_text = response_text.split("```")[1].split("```")[0].strip()
    
    try:
        result = json.loads(response_text)
        image_number = result['image_number']
        if 1 <= image_number <= len(images_data):
            return image_number - 1
        else:
            print(f"Invalid image number {image_number}, using first image", file=sys.stderr)
            return 0
    except (json.JSONDecodeError, KeyError) as e:
        print(f"Failed to parse batch classification: {response_text}", file=sys.stderr)
        return 0



def main():
    """Test classification on a saved image."""
    import argparse
    from pathlib import Path
    
    parser = argparse.ArgumentParser(description="Classify a figure image")
    parser.add_argument('image_path', type=Path, help='Path to image file')
    parser.add_argument('--caption', default='', help='Optional caption text')
    
    args = parser.parse_args()
    
    if not os.environ.get("GOOGLE_CLOUD_API_KEY"):
        print("Error: GOOGLE_CLOUD_API_KEY environment variable not set", file=sys.stderr)
        sys.exit(1)
    
    try:
        with open(args.image_path, 'rb') as f:
            img_bytes = f.read()
        
        print(f"Classifying image: {args.image_path}", file=sys.stderr)
        result = classify_figures(img_bytes, args.caption)
        
        print(f"\n=== Classification Result ===")
        print(f"Type: {result['type']}")
        print(f"Confidence: {result['confidence']:.2f}")
        print(f"Reasoning: {result['reasoning']}")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

