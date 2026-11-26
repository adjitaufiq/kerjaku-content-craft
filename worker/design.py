"""Deterministic typography for real poster/carousel raster outputs, separate from captions."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

PALETTE = {"ink": "#141C22", "paper": "#F5F7F9", "cyan": "#20D7D2", "yellow": "#F6DD48", "muted": "#A4B1B8"}


def fit_text(draw, text, box, color, size=72, minimum=22, bold=True):
    x, y, width, height = box
    family = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    for point in range(size, minimum - 1, -2):
        font = ImageFont.truetype(family, point)
        lines, line = [], ""
        for word in text.split():
            trial = (line + " " + word).strip()
            if draw.textlength(trial, font=font) > width and line:
                lines.append(line)
                line = word
            else:
                line = trial
        if line:
            lines.append(line)
        if any(draw.textlength(line, font=font) > width for line in lines):
            continue
        spacing = int(point * 1.22)
        if len(lines) * spacing <= height:
            for index, line in enumerate(lines):
                draw.text((x, y + index * spacing), line, fill=color, font=font)
            return
    raise ValueError("Typography exceeds image bounds; hold for review")


def scene_list(content):
    import json
    try:
        scenes = json.loads(content["production"]["scenes"])
        if isinstance(scenes, list) and len(scenes) >= 2:
            return scenes
    except (ValueError, TypeError):
        pass
    p = content["production"]
    return [{"heading": p["hook"] or content["title"], "narration": p["script"], "visual": content["prompt"]},
            {"heading": p["cta"], "narration": p["cta"], "visual": p["visualDirection"]}]


def render_card(image_path, heading, body, cta, output, number=None, total=None, role="content", layout=""):
    width, height = 1080, 1350
    cover = role == "cover"
    closing = role == "cta"
    canvas = Image.new("RGB", (width, height), PALETTE["ink"] if cover or closing else PALETTE["paper"])
    draw = ImageDraw.Draw(canvas)
    ink = PALETTE["paper"] if cover or closing else PALETTE["ink"]
    accent = PALETTE["cyan"] if cover or closing else PALETTE["ink"]
    fit_text(draw, "KERJAKU", (64, 52, 650, 60), ink, 32)
    if number is not None:
        fit_text(draw, f"{number:02} / {total:02}", (840, 52, 190, 60), ink, 27)
    with Image.open(image_path) as source:
        source = source.convert("RGB")
        if cover:
            photo = ImageOps.fit(source, (1080, 680))
            canvas.paste(photo, (0, 520))
            fit_text(draw, heading, (64, 158, 952, 300), ink, 88)
            draw.rectangle((64, 1218, 1016, 1290), fill=PALETTE["yellow"])
            fit_text(draw, " ".join(body.split()[:18]), (82, 1232, 916, 54), PALETTE["ink"], 28)
        elif closing:
            canvas.paste(ImageOps.fit(source, (430, 470)), (586, 188))
            fit_text(draw, heading, (64, 178, 460, 420), ink, 76)
            draw.line((64, 728, 1016, 728), fill=accent, width=4)
            fit_text(draw, body, (64, 788, 952, 250), ink, 42, bold=False)
            fit_text(draw, cta, (64, 1120, 952, 160), PALETTE["yellow"], 48)
        elif any(word in layout.lower() for word in ("compar", "before", "after", "banding")):
            fit_text(draw, heading, (64, 156, 952, 215), ink, 66)
            canvas.paste(ImageOps.fit(source, (952, 510)), (64, 426))
            draw.line((64, 968, 1016, 968), fill=PALETTE["cyan"], width=8)
            fit_text(draw, body, (64, 1010, 952, 240), ink, 40, bold=False)
        else:
            fit_text(draw, heading, (64, 156, 952, 218), ink, 68)
            # Alternate visual hierarchy rather than repeat the same card for all content.
            if number and number % 2 == 0:
                canvas.paste(ImageOps.fit(source, (952, 550)), (64, 414))
                fit_text(draw, body, (64, 1020, 952, 240), ink, 40, bold=False)
            else:
                canvas.paste(ImageOps.fit(source, (460, 660)), (556, 430))
                fit_text(draw, body, (64, 438, 440, 690), ink, 46, bold=False)
    canvas.save(output)
    return canvas


def design_bundle(content, images, output, formats, slides=7):
    if slides not in (5, 7, 10) or not images:
        raise ValueError("Carousel requires 5, 7 or 10 slides and real image assets")
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    scenes, p = scene_list(content), content["production"]
    files = []
    if "Foto" in formats:
        card = render_card(images[0], p["hook"] or content["title"], scenes[0]["narration"], p["cta"], output / "poster.png", role="cover")
        card.save(output / "poster.jpg", quality=94)
        files += [output / "poster.png", output / "poster.jpg"]
    if "Carousel" in formats:
        package = p.get("carouselPackage")
        plan = [(s["headline"], s["supporting_text"]) for s in package["slides"]] if package else carousel_plan(content, slides)
        if len(plan) != slides:
            raise ValueError("Carousel storyboard count mismatch")
        for index, (heading, body) in enumerate(plan):
            path = output / f"carousel-{index + 1:02}.png"
            role = "cover" if index == 0 else "cta" if index == slides - 1 else "content"
            layout = package["slides"][index].get("layout_direction", "") if package else scenes[index % len(scenes)].get("layout_direction", "")
            if package and len(images) != slides:
                raise ValueError("Every carousel slide requires a matching image")
            render_card(images[index % len(images)], heading, body, p["cta"] if role == "cta" else "", path, index + 1, slides, role=role, layout=layout)
            files.append(path)
    return files


def carousel_plan(content, slides):
    """Each source word is assigned once, in order; never duplicate a slide to hit a count."""
    if slides not in (5, 7, 10):
        raise ValueError("Unsupported carousel length")
    import re
    scenes, p = scene_list(content), content["production"]
    middle = scenes[1:-1]
    units = [(scene["heading"], text.strip()) for scene in middle
             for text in re.split(r"(?<=[.!?])\s+", scene["narration"]) if text.strip()]
    if len(units) < slides - 2:
        units = [(scene["heading"], word) for scene in middle for word in scene["narration"].split()]
    count = slides - 2
    if len(units) < count:
        raise ValueError("Carousel material insufficient; hold instead of repeating slides")
    result = [(p["hook"] or content["title"], scenes[0]["narration"])]
    for index in range(count):
        start, end = index * len(units) // count, (index + 1) * len(units) // count
        result.append((units[start][0], " ".join(text for _, text in units[start:end])))
    result.append((scenes[-1]["heading"], scenes[-1]["narration"]))
    return result