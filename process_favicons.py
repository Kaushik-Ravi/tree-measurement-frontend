"""
Process favicon images with circular crop and generate multiple sizes
"""
from PIL import Image, ImageDraw, ImageOps
import os

def create_circular_mask(size):
    """Create a circular mask for the image"""
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0) + size, fill=255)
    return mask

def process_favicon(input_path, output_base_name, sizes=[16, 32, 180, 192, 512]):
    """
    Process a favicon image:
    1. Auto-detect content bounds and crop tight
    2. Add small padding (3%)
    3. Apply circular crop
    4. Generate multiple sizes
    5. Save optimized versions
    """
    # Open the original image
    img = Image.open(input_path)
    
    # Convert to RGBA if needed (for transparency)
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    # Smart content detection that works for both light and dark backgrounds
    # Convert to grayscale for edge detection
    gray = img.convert('L')
    pixels = gray.load()
    width, height = gray.size
    
    # Calculate average brightness to determine if background is light or dark
    total_brightness = sum(pixels[x, y] for y in range(height) for x in range(width))
    avg_brightness = total_brightness / (width * height)
    
    print(f"  💡 Average brightness: {avg_brightness:.1f}")
    
    # Find bounds based on content detection
    min_x, min_y = width, height
    max_x, max_y = 0, 0
    
    # Adaptive threshold based on background
    if avg_brightness > 200:
        # Light background - look for darker pixels
        threshold = 250
        is_light_bg = True
        print(f"  🌞 Light background detected - looking for pixels < {threshold}")
    else:
        # Dark background - look for pixels that differ from background
        # Use lower threshold to catch green leaves (around 100-150 brightness)
        threshold = 50
        is_light_bg = False
        print(f"  🌙 Dark background detected - looking for pixels > {threshold}")
    
    for y in range(height):
        for x in range(width):
            pixel_val = pixels[x, y]
            # For light background: find dark content
            # For dark background: find light content
            is_content = (pixel_val < threshold) if is_light_bg else (pixel_val > threshold)
            
            if is_content:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    
    # If we found content, crop to it
    if max_x > min_x and max_y > min_y:
        bbox = (min_x, min_y, max_x + 1, max_y + 1)
        original_size = img.size
        img = img.crop(bbox)
        print(f"  📐 Tight crop applied: {bbox}")
        print(f"  📏 Cropped from {original_size[0]}×{original_size[1]} to {img.size[0]}×{img.size[1]}")
    
    # Add 3% padding around the content (small padding for tight look)
    padding_percent = 0.03
    width, height = img.size
    padding_x = int(width * padding_percent)
    padding_y = int(height * padding_percent)
    
    # Create new image with padding
    new_size = (width + 2 * padding_x, height + 2 * padding_y)
    padded_img = Image.new('RGBA', new_size, (255, 255, 255, 0))
    padded_img.paste(img, (padding_x, padding_y))
    img = padded_img
    
    # Now make it square by taking the larger dimension
    max_dim = max(img.size)
    
    # Center the image in a square canvas
    square_img = Image.new('RGBA', (max_dim, max_dim), (255, 255, 255, 0))
    paste_x = (max_dim - img.size[0]) // 2
    paste_y = (max_dim - img.size[1]) // 2
    square_img.paste(img, (paste_x, paste_y))
    img_square = square_img
    
    # Apply circular mask
    mask = create_circular_mask(img_square.size)
    
    # Create output with transparency
    output = Image.new('RGBA', img_square.size, (0, 0, 0, 0))
    output.paste(img_square, (0, 0))
    output.putalpha(mask)
    
    # Save the full-size circular version
    output.save(f'public/{output_base_name}_circular.png', 'PNG', optimize=True)
    print(f'✅ Created {output_base_name}_circular.png ({output.size[0]}×{output.size[1]})')
    
    # Generate various sizes for different use cases
    for size in sizes:
        resized = output.resize((size, size), Image.Resampling.LANCZOS)
        filename = f'public/{output_base_name}_{size}x{size}.png'
        resized.save(filename, 'PNG', optimize=True)
        print(f'✅ Created {output_base_name}_{size}×{size}.png')
    
    # Create the main favicon.ico (16x16 and 32x32)
    if output_base_name == 'favicon_dark':
        favicon_sizes = [(16, 16), (32, 32)]
        favicon_images = [output.resize(size, Image.Resampling.LANCZOS) for size in favicon_sizes]
        favicon_images[0].save('public/favicon.ico', format='ICO', sizes=favicon_sizes, append_images=favicon_images[1:])
        print(f'✅ Created favicon.ico (multi-resolution)')

def main():
    print("🎨 Processing Roots Favicon Images\n")
    print("=" * 50)
    
    # Process dark theme favicon
    print("\n📁 Processing Dark Theme:")
    process_favicon('public/Favicon_dark.png', 'favicon_dark')
    
    # Process light theme favicon
    print("\n📁 Processing Light Theme:")
    process_favicon('public/Favicon_light.png', 'favicon_light')
    
    print("\n" + "=" * 50)
    print("✨ All favicons processed successfully!")
    print("\nGenerated files:")
    print("  • favicon_dark_circular.png (1024×1024) - Full resolution")
    print("  • favicon_light_circular.png (1024×1024) - Full resolution")
    print("  • favicon_dark_16x16.png - Browser tab")
    print("  • favicon_dark_32x32.png - Desktop bookmark")
    print("  • favicon_dark_180x180.png - iOS")
    print("  • favicon_dark_192x192.png - Android")
    print("  • favicon_dark_512x512.png - PWA")
    print("  • favicon_light_* (same sizes)")
    print("  • favicon.ico - Multi-resolution ICO file")

if __name__ == '__main__':
    main()
