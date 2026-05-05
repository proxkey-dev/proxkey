#!/usr/bin/env python3
"""
Download specific integration icons from Icons8 Color Pixels style
"""
import os
import requests
from bs4 import BeautifulSoup
import re
import time

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "image/png,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://icons8.com/",
}

# Icons to download - mapping integration name to Icons8 search terms
ICONS_TO_DOWNLOAD = {
    'nodejs': ['nodejs', 'javascript', 'js', 'node'],
    'python': ['python'],
    'golang': ['golang', 'go language'],
    'cloudflare': ['cloudflare', 'cloud', 'serverless'],
    'webhook': ['webhook', 'notification', 'bell', 'alert'],
    'bun': ['bun', 'javascript runtime', 'js runtime'],
}

BASE_URL = "https://icons8.com/icons/all--style-color-pixels"
SAVE_DIR = "public/pixel_icons/icons8_programming"

def clean_filename(name: str) -> str:
    """Clean filename for filesystem"""
    name = name.lower().replace(" ", "_").replace("-", "_")
    return re.sub(r"[^a-z0-9_]", "", name)

def download_icon(icon_name: str, search_terms: list):
    """Download an icon from Icons8 by searching"""
    print(f"\nSearching for: {icon_name}")
    print(f"Search terms: {', '.join(search_terms)}")
    
    # Try to find the icon on Icons8
    # We'll search the Color Pixels page
    search_url = f"{BASE_URL}?q={'+'.join(search_terms[:1])}"
    
    try:
        response = requests.get(search_url, headers=HEADERS, timeout=10)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            
            # Find images with icons8.com URLs
            images = soup.find_all("img", {"src": re.compile("img.icons8.com")})
            
            if images:
                # Get the first matching image
                img = images[0]
                img_url = img.get("src", "")
                
                if img_url:
                    # Extract icon name from URL
                    # Pattern: https://img.icons8.com/pixels/32/nodejs.png
                    icon_name_match = re.search(r"/([a-zA-Z0-9_-]+)\.(png|jpg|svg)$", img_url)
                    if icon_name_match:
                        base_icon_name = icon_name_match.group(1)
                        
                        # Try to download PNG (32px or 512px)
                        png_urls = [
                            f"https://img.icons8.com/pixels/512/{base_icon_name}.png",
                            f"https://img.icons8.com/pixels/32/{base_icon_name}.png",
                            img_url.replace("1200", "512") if "1200" in img_url else img_url,
                        ]
                        
                        os.makedirs(SAVE_DIR, exist_ok=True)
                        filename = f"{icon_name}.png"
                        filepath = os.path.join(SAVE_DIR, filename)
                        
                        # Skip if already exists
                        if os.path.exists(filepath):
                            print(f"✓ Already exists: {filename}")
                            return True
                        
                        for png_url in png_urls:
                            try:
                                img_response = requests.get(png_url, headers=HEADERS, timeout=10)
                                if img_response.status_code == 200 and img_response.headers.get("content-type", "").startswith("image/"):
                                    with open(filepath, "wb") as f:
                                        f.write(img_response.content)
                                    print(f"✓ Downloaded: {filename}")
                                    return True
                            except Exception as e:
                                continue
                        
                        print(f"✗ Failed to download: {icon_name}")
                        return False
        else:
            print(f"✗ Failed to fetch search page: {search_url}")
            return False
            
    except Exception as e:
        print(f"✗ Error searching for {icon_name}: {e}")
        return False

def main():
    """Download all integration icons"""
    print("=" * 60)
    print("Downloading Integration Icons from Icons8")
    print("=" * 60)
    
    downloaded = 0
    for icon_name, search_terms in ICONS_TO_DOWNLOAD.items():
        if download_icon(icon_name, search_terms):
            downloaded += 1
        time.sleep(1)  # Be polite to the server
    
    print(f"\n{'=' * 60}")
    print(f"Downloaded {downloaded}/{len(ICONS_TO_DOWNLOAD)} icons")
    print(f"{'=' * 60}")

if __name__ == "__main__":
    main()




