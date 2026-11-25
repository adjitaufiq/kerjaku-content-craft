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


def render_card(image_path, heading, body, cta, output, number=None, total=None):
    width, height = 1080, 1350
    canvas = Image.new("RGB", (width, height), PALETTE["ink"])
    draw = ImageDraw.Draw(canvas)
    accent = PALETTE["cyan"] if number is None or number % 2 else PALETTE["yellow"]
    draw.rectangle((64, 64, 74, 104), fill=accent)
    fit_text(draw, "KERJAKU", (94, 60, 680, 80), PALETTE["paper"], 38)
    if number is not None:
        fit_text(draw, f"{number:02} / {total:02}", (835, 67, 190, 60), PALETTE["muted"], 27)
    fit_text(draw, heading, (64, 158, 944, 285), PALETTE["paper"], 74)
    with Image.open(image_path) as source:
        photo = ImageOps.fit(source.convert("RGB"), (944, 435), centering=(.5, .5))
        canvas.paste(photo, (64, 477))
    draw.rectangle((64, 927, 1016, 934), fill=accent)
    fit_text(draw, body, (64, 962, 942, 217), PALETTE["paper"], 34, bold=False)
    fit_text(draw, cta, (64, 1222, 875, 64), accent, 28)
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
        card = render_card(images[0], p["hook"] or content["title"], scenes[0]["narration"], p["cta"], output / "poster.png")
        card.save(output / "poster.jpg", quality=94)
        files += [output / "poster.png", output / "poster.jpg"]
    if "Carousel" in formats:
        for index, (heading, body) in enumerate(carousel_plan(content, slides)):
            path = output / f"carousel-{index + 1:02}.png"
            render_card(images[index % len(images)], heading, body, p["cta"] if index == slides - 1 else "KERJAKU · AI AUTOMATION" if "AI" in content["title"] else "KERJAKU", path, index + 1, slides)
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