#!/usr/bin/env python3
"""
Make the chakra silhouette fully solid black.
Strategy: Dilate body into thin white gaps to close holes, then flood fill exterior.
"""
from PIL import Image, ImageDraw, ImageFilter

INPUT = "src/assets/chakra-reference-cutout.png"
OUTPUT = "src/assets/chakra-reference-cutout.png"
EXTERIOR = 1

def dilate_body(work_pix, w, h, passes=3):
    """Expand body (255) into adjacent white (128) to close thin gaps."""
    for _ in range(passes):
        changes = []
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                if work_pix[x, y] == 128:
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            if work_pix[x + dx, y + dy] == 255:
                                changes.append((x, y))
                                break
        for x, y in changes:
            work_pix[x, y] = 255

def main():
    img = Image.open(INPUT).convert("RGBA")
    w, h = img.size
    pix = img.load()

    # 128 = exterior candidate (transparent or white), 255 = body
    work = Image.new("L", (w, h), 0)
    work_pix = work.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            is_transparent = a < 50
            is_white = r > 245 and g > 245 and b > 245
            work_pix[x, y] = 128 if (is_transparent or is_white) else 255

    # Dilate body into white to close thin gaps connecting holes to exterior
    dilate_body(work_pix, w, h, passes=12)

    # Flood fill from edges: 128 connected to edge -> EXTERIOR
    step = max(1, min(w, h) // 50)
    seeds = (
        [(0, y) for y in range(0, h, step)] + [(w - 1, y) for y in range(0, h, step)] +
        [(x, 0) for x in range(0, w, step)] + [(x, h - 1) for x in range(0, w, step)]
    )
    for xy in seeds:
        if work_pix[xy[0], xy[1]] == 128:
            ImageDraw.floodfill(work, xy, EXTERIOR, thresh=0)

    # Output: EXTERIOR -> transparent, else -> solid black
    out = Image.new("RGBA", img.size)
    out_pix = out.load()
    for y in range(h):
        for x in range(w):
            if work_pix[x, y] == EXTERIOR:
                out_pix[x, y] = (0, 0, 0, 0)
            else:
                out_pix[x, y] = (0, 0, 0, 255)

    out.save(OUTPUT)
    print(f"Saved solid black silhouette to {OUTPUT}")

if __name__ == "__main__":
    main()
