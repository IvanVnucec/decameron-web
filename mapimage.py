"""Static world map of every camera, in the same style as the live map on the coverage page.

Land, borders and camera dots use the colours of the coverage page's map (CARTO Dark Matter
and its blue dots); the sea is white so the map sits on the page's white background.
Coastlines, lakes and borders come from Natural Earth (public domain).
"""
import json
import math

from PIL import Image, ImageDraw

WATER = (0xFF, 0xFF, 0xFF)
LAND = (0x0E, 0x0E, 0x0E)
BORDER = (92, 94, 94)
DOT = (0x38, 0xBD, 0xF8)
DOT_OPACITY = 0.85

NORTH, SOUTH = 76, -55  # every continent but Antarctica; trims only the high Arctic
WIDTH = 2000            # output pixels
DOT_RADIUS = 2.0        # output pixels; about what the live map draws at world zoom
SUPERSAMPLE = 3         # draw bigger, then shrink, for smooth coastlines and round dots


def _miller(lat):
    """Miller projection: looks like the live map's Mercator, but with the far north squashed
    so the whole world fits in a 2:1 image."""
    return 1.25 * math.log(math.tan(math.pi / 4 + 0.4 * math.radians(lat)))


def _polygons(path):
    """(exterior, holes) for every polygon in a GeoJSON file."""
    for feature in json.loads(path.read_text(encoding="utf-8"))["features"]:
        geometry = feature["geometry"]
        if geometry is None:
            continue
        polys = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
        for rings in polys:
            yield rings[0], rings[1:]


def _lines(path):
    for feature in json.loads(path.read_text(encoding="utf-8"))["features"]:
        geometry = feature["geometry"]
        if geometry is None:
            continue
        yield from [geometry["coordinates"]] if geometry["type"] == "LineString" else geometry["coordinates"]


def render(cams, land, lakes, borders, out_path):
    """Draw cams [(lat, lng, ...)] over the basemap and save it (WebP: ~150 KB vs ~650 KB as PNG)."""
    s = SUPERSAMPLE
    top, bottom = _miller(NORTH), _miller(SOUTH)
    w = WIDTH * s
    h = round(w * (top - bottom) / (2 * math.pi))

    def xy(lng, lat):
        return (lng + 180) / 360 * w, (top - _miller(lat)) / (top - bottom) * h

    image = Image.new("RGB", (w, h), WATER)
    draw = ImageDraw.Draw(image)

    for path, fill, hole_fill in ((land, LAND, WATER), (lakes, WATER, LAND)):
        for exterior, holes in _polygons(path):
            draw.polygon([xy(*p[:2]) for p in exterior], fill=fill)
            for hole in holes:
                draw.polygon([xy(*p[:2]) for p in hole], fill=hole_fill)

    for line in _lines(borders):
        draw.line([xy(*p[:2]) for p in line], fill=BORDER, width=max(1, round(0.7 * s)), joint="curve")

    dot = tuple(round(DOT_OPACITY * c + (1 - DOT_OPACITY) * b) for c, b in zip(DOT, LAND))
    r = DOT_RADIUS * s
    for lat, lng, *_ in cams:
        if SOUTH <= lat <= NORTH:
            x, y = xy(lng, lat)
            draw.ellipse((x - r, y - r, x + r, y + r), fill=dot)

    image.resize((WIDTH, round(h / s)), Image.LANCZOS).save(out_path, "WEBP", quality=90, method=6)
