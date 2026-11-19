# v2.saleswaves.mn

Build алхамгүй статик сайт (HTML + CSS + ES modules). Three.js r170 локал байрласан.

## Бүтэц
- `index.html` — хуудас (MN үндсэн, EN орчуулга `assets/i18n.js`)
- `assets/css/site.css` — цайвар, editorial логистик загвар (Onest + IBM Plex Mono)
- `assets/js/site.js` — хэл, цэс, гүйлгэлт ↔ 3D аяллын синк, маягт
- `assets/js/journey/journey.js` — гүйлгэлтээр удирдагдах 3D аялал:
  Японы аукционы талбай → боомтод контейнерт ачих → STS кран → далайн тээвэр →
  Хятадын боомтод галт тэргэнд шилжүүлэх → тал хээр → Улаанбаатарт хүлээлгэн өгөх
- `assets/js/journey/models.js` — кодоор бүтээсэн PBR загварууд (машин 3 төрөл + LOD, контейнер,
  хөлөг, кран, зүтгүүр/вагон, хот)
- `assets/js/journey/textures.js` — процедурал текстурууд
- `assets/env/sky_1k.hdr` — Poly Haven "Kloofendal 48d Partly Cloudy (Pure Sky)", CC0

## Локал ажиллуулах
```bash
cd v2 && python3 -m http.server 8080
```

## Анхаарах
- Маягт `mailto:info@saleswaves.mn`-ээр ажилладаг; шууд илгээхэд backend endpoint холбох хэрэгтэй.
- Статистик тоонууд одоогийн сайтаас авсан статик утга.
- WebGL байхгүй үед 3D хэсэг мэдэгдэл харуулж, текст контент хэвээр ажиллана.
