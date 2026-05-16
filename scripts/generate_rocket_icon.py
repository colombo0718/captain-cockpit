"""Generate rocket.ico from Segoe UI Emoji - the BIG ROCKET colombo wants."""
import sys
import io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent.parent / "media" / "rocket.ico"
OUT.parent.mkdir(parents=True, exist_ok=True)

FONT_PATH = "C:/Windows/Fonts/seguiemj.ttf"
EMOJI = "🚀"

# Generate base 256x256 with color emoji
base_size = 256
img = Image.new("RGBA", (base_size, base_size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Use largest size that fits, then center
font = ImageFont.truetype(FONT_PATH, 220)
try:
    draw.text(
        (base_size // 2, base_size // 2),
        EMOJI,
        font=font,
        embedded_color=True,
        anchor="mm",
    )
except TypeError:
    # Older Pillow without embedded_color - fallback grayscale
    draw.text((base_size // 2, base_size // 2), EMOJI, font=font, anchor="mm")

# Save as multi-resolution ICO
sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
img.save(OUT, format="ICO", sizes=sizes)

print(f"OK rocket.ico generated: {OUT}")
print(f"   sizes: {sizes}")
print(f"   size on disk: {OUT.stat().st_size / 1024:.1f} KB")
