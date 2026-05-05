import os
import requests
from bs4 import BeautifulSoup
import re
import time

# ---------- CONFIG: Add all sets here --------- #
ICON_SETS = {
    "data": "https://icons8.com/icons/set/data--style-pixels",
    "computer_hardware": "https://icons8.com/icons/set/computer-hardware--style-pixels",
    "mobile": "https://icons8.com/icons/set/mobile--style-pixels",
    "programming": "https://icons8.com/icons/set/programming--style-pixels",
    "folders": "https://icons8.com/icons/set/folders--style-pixels",
    "profile": "https://icons8.com/icons/set/profile--style-pixels",
    "user_interface": "https://icons8.com/icons/set/user-interface--style-pixels",
    "time_and_date": "https://icons8.com/icons/set/time-and-date--style-pixels",
    "arrows": "https://icons8.com/icons/set/arrows--style-pixels",
    "editing": "https://icons8.com/icons/set/editing--style-pixels",
    "hands": "https://icons8.com/icons/set/hands--style-pixels",
    "clothing": "https://icons8.com/icons/set/clothing--style-pixels",
}
# ------------------------------------------------ #

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://icons8.com/",
}

def clean_filename(name: str) -> str:
    name = name.lower().replace(" ", "_").replace("-", "_")
    return re.sub(r"[^a-z0-9_]", "", name)

def download_svg(svg_url, dest):
    try:
        r = requests.get(svg_url, headers=HEADERS, timeout=10)
        if r.status_code == 200:
            content = r.text.strip()
            if content.startswith("<svg") or content.startswith("<?xml"):
                with open(dest, "w", encoding="utf-8") as f:
                    f.write(content)
                return True
    except Exception as e:
        pass
    return False

def download_png_as_fallback(png_url, dest_svg_path):
    """Try to download PNG as fallback, save as SVG (will be PNG data but with .svg extension)"""
    try:
        r = requests.get(png_url, headers=HEADERS, timeout=10)
        if r.status_code == 200 and r.headers.get("content-type", "").startswith("image/"):
            # Save as PNG instead
            png_path = dest_svg_path.replace(".svg", ".png")
            with open(png_path, "wb") as f:
                f.write(r.content)
            return True
    except:
        pass
    return False

def scrape_set(set_name, url):
    print(f"\n==============================")
    print(f"Downloading set: {set_name}")
    print(f"URL: {url}")
    print("==============================\n")
    
    save_dir = f"icons8_{set_name}"
    os.makedirs(save_dir, exist_ok=True)
    
    html = requests.get(url, headers=HEADERS, timeout=10).text
    soup = BeautifulSoup(html, "html.parser")
    
    # Find all images with icons8.com URLs
    images = soup.find_all("img", {"src": re.compile("img.icons8.com")})
    
    print(f"Found {len(images)} images in {set_name}.\n")
    
    downloaded = 0
    processed_names = set()
    
    # Process each image
    for img in images:
        img_url = img.get("src", "")
        if not img_url:
            continue
        
        # Get icon name from alt text
        name = img.get("alt", "icon")
        # Clean up the name (remove "pixels style" prefix if present)
        name = re.sub(r"^pixels style\s+", "", name, flags=re.I)
        name = re.sub(r"\s+icon$", "", name, flags=re.I)
        
        filename = clean_filename(name) + ".svg"
        
        # Skip if already processed
        if filename in processed_names:
            continue
        processed_names.add(filename)
        
        path = os.path.join(save_dir, filename)
        
        # Skip if already downloaded
        if os.path.exists(path):
            continue
        
        # Extract icon name from URL
        # Pattern: https://img.icons8.com/pixels/32/add-folder.png
        # or: https://img.icons8.com/pixels/1200/add-folder.jpg
        icon_name_match = re.search(r"/([a-zA-Z0-9_-]+)\.(png|jpg|svg)$", img_url)
        if icon_name_match:
            icon_name = icon_name_match.group(1)
            
            # Try multiple SVG URL patterns
            svg_urls = [
                f"https://img.icons8.com/pixels/{icon_name}.svg",
                f"https://img.icons8.com/pixels/SVG/{icon_name}.svg",
                img_url.replace(".png", ".svg").replace(".jpg", ".svg"),
                re.sub(r"/\d+/", "/", img_url.replace(".png", ".svg").replace(".jpg", ".svg")),
            ]
            
            success = False
            for svg_url in svg_urls:
                if download_svg(svg_url, path):
                    print(f"✔ Saved {filename}")
                    downloaded += 1
                    success = True
                    break
            
            # If SVG failed, try downloading PNG as fallback
            if not success and (".png" in img_url or ".jpg" in img_url):
                # Try to get a higher quality PNG (32px or 512px)
                png_urls = [
                    img_url.replace("1200", "512").replace(".jpg", ".png"),
                    img_url.replace("1200", "32").replace(".jpg", ".png"),
                    img_url if ".png" in img_url else img_url.replace(".jpg", ".png"),
                ]
                for png_url in png_urls:
                    if download_png_as_fallback(png_url, path):
                        print(f"✔ Saved {filename.replace('.svg', '.png')} (PNG fallback)")
                        downloaded += 1
                        success = True
                        break
            
            if not success:
                print(f"✖ No SVG/PNG available for: {name} (tried {len(svg_urls)} URL patterns)")
        else:
            print(f"✖ Could not extract icon name from: {img_url}")
        
        time.sleep(0.2)
    
    print(f"\nDone: {set_name} - Downloaded {downloaded} icons\n")

# -------- Run the scraper for all sets -------- #
# Uncomment the line below to test with just one set first
# scrape_set("data", ICON_SETS["data"])

for set_name, url in ICON_SETS.items():
    scrape_set(set_name, url)

print("\nAll sets downloaded successfully!")

