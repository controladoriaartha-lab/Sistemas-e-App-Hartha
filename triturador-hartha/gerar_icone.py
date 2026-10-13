"""Gera icone.ico (triturador de papel). Requer Pillow; o icone ja vem pronto no pacote."""
from PIL import Image, ImageDraw

S = 1024
im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.rounded_rectangle((20, 20, S - 20, S - 20), 200, fill=(20, 38, 66, 255))           # fundo azul-marinho
d.rounded_rectangle((20, 20, S - 20, S - 20), 200, outline=(212, 175, 55, 255), width=28)  # borda dourada
# papel entrando
d.polygon([(330, 110), (690, 110), (690, 380), (330, 380)], fill=(245, 245, 240, 255))
for y in (180, 235, 290):
    d.rectangle((380, y, 640, y + 18), fill=(150, 160, 175, 255))
# corpo da maquina
d.rounded_rectangle((150, 360, 874, 560), 60, fill=(200, 45, 45, 255))
d.rounded_rectangle((260, 410, 764, 440), 15, fill=(60, 10, 10, 255))               # boca
d.ellipse((760, 470, 800, 510), fill=(255, 220, 90, 255))                            # led
# tiras de papel trituradas
for i, x in enumerate(range(190, 840, 66)):
    h = 250 + (i % 3) * 45
    d.rectangle((x, 570, x + 42, 570 + h), fill=(245, 245, 240, 255))
    d.rectangle((x, 570 + h - 14, x + 42, 570 + h), fill=(190, 195, 205, 255))
im = im.resize((256, 256), Image.LANCZOS)
im.save("icone.ico", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
im.save("icone.png")
