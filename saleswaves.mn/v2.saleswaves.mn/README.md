# v2.saleswaves.mn

`saleswaves.mn.sln` доторх тусдаа ASP.NET Core (net8.0) проект. Статик сайт (HTML + CSS + ES modules)
`wwwroot`-д байрлах ба `Program.cs` нь зөвхөн статик файл үйлчилнэ (Brotli/Gzip шахалт, кэш, `.hdr` MIME,
аюулгүй байдлын header-үүд, үл мэдэгдэх замыг `index.html` руу чиглүүлнэ). Three.js r170 локал байрласан.

## Бүтэц
- `wwwroot/index.html` — хуудас (MN үндсэн, EN орчуулга `assets/i18n.js`)
- `wwwroot/assets/css/site.css` — цайвар, editorial логистик загвар (Onest + IBM Plex Mono)
- `wwwroot/assets/js/site.js` — хэл, цэс, гүйлгэлт ↔ 3D аяллын синк, маягт
- `wwwroot/assets/js/journey/journey.js` — гүйлгэлтээр удирдагдах 3D аялал:
  Японы аукционы талбай → боомтод контейнерт ачих → STS кран → далайн тээвэр →
  Хятадын боомтод галт тэргэнд шилжүүлэх → тал хээр → Улаанбаатарт хүлээлгэн өгөх
- `wwwroot/assets/js/journey/models.js` — кодоор бүтээсэн PBR загварууд (машин 3 төрөл + LOD, контейнер,
  хөлөг, кран, зүтгүүр/вагон, хот)
- `wwwroot/assets/js/journey/textures.js` — процедурал текстурууд
- `wwwroot/assets/env/sky_1k.hdr` — Poly Haven "Kloofendal 48d Partly Cloudy (Pure Sky)", CC0

## Локал ажиллуулах
**Visual Studio:** `saleswaves.mn.sln` нээгээд Solution Explorer дээр `v2.saleswaves.mn` → баруун товч →
**Set as Startup Project** → `F5`. Хөтөч `http://localhost:5090` (эсвэл `https://localhost:7090`) хаягаар нээгдэнэ.

**CLI:**
```bash
dotnet run --project saleswaves.mn/v2.saleswaves.mn
```

## Байршуулах (IIS)
```bash
dotnet publish saleswaves.mn/v2.saleswaves.mn -c Release -o publish/v2
```
`publish/v2`-г IIS дээр шинэ сайт болгон тавьж, binding-д `v2.saleswaves.mn`, DNS-д `v2` бичлэг нэмнэ.

## Анхаарах
- Маягт `mailto:info@saleswaves.mn`-ээр ажилладаг; шууд илгээхэд backend endpoint холбох хэрэгтэй.
- Статистик тоонууд одоогийн сайтаас авсан статик утга.
- WebGL байхгүй үед 3D хэсэг мэдэгдэл харуулж, текст контент хэвээр ажиллана.
