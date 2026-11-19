# v2.saleswaves.mn

`saleswaves.mn.sln` доторх тусдаа ASP.NET Core (net8.0) проект. Статик сайт (HTML + CSS + ES modules)
`wwwroot`-д байрлах ба `Program.cs` нь зөвхөн статик файл үйлчилнэ (Brotli/Gzip шахалт, кэш,
аюулгүй байдлын header-үүд, үл мэдэгдэх замыг `index.html` руу чиглүүлнэ). Three.js r170 локал байрласан.

## Бүтэц
- `wwwroot/index.html` — хуудас (MN үндсэн, EN орчуулга `assets/i18n.js`)
- `wwwroot/assets/css/site.css` — загвар (Onest + IBM Plex Mono)
- `wwwroot/assets/js/site.js` — хэл, цэс, гүйлгэлт ↔ 3D аяллын синк, маягт
- `wwwroot/assets/js/journey/journey.js` — гүйлгэлтээр удирдагдах 3D аялал: бодит өгөгдлөөр бүтсэн рельеф бөмбөрцөг
  (Зүүн Ази), түүн дээрх замнал, тэмдэглэгээ, камер, замналын самбар (координат, туулсан км)
- `wwwroot/assets/js/journey/geo.js` — газар зүй: замналын цэгүүд (`SEA`, `RAIL`), боомт/хот (`PLACES`),
  аукционы бүсүүд (`AUCTIONS`), Монголын хилийн тойм. **Боомт, замнал өөрчлөх бол зөвхөн энэ файлыг засна.**
- `wwwroot/assets/map/` — урьдчилан боловсруулсан газрын зураг: `relief_4k.jpg` / `relief_2k.jpg` (нарийвчилсан хэсэг,
  96–150°E · 24–56°N), `far.jpg` (алсын дэвсгэр), `height.png` (өндөршил)
- `tools/build-map.mjs` — дээрх зургуудыг эх өгөгдлөөс дахин үүсгэх скрипт (сайтад хэрэглэгдэхгүй)

## 3D аяллын өгөгдөл
Газрын зураг нь зохиомол биш, нээлттэй бодит өгөгдлөөс бүтсэн:
- Өнгө: NASA Blue Marble Next Generation (GIBS) — нийтийн эзэмшил
- Өндөршил ба далайн гүн: Terrarium tiles (AWS Open Data / Mapzen) — SRTM, GMTED2010, ETOPO1
- Монголын хил: Natural Earth 1:50m — нийтийн эзэмшил

`tools/build-map.mjs` нь өндөршлөөс гэрэл сүүдэр (налуугийн гэрэлтүүлэг, зөөлөн сүүдэр) тооцоолж хиймэл дагуулын өнгөтэй
нийлүүлэн нэг зураг болгодог. Дахин үүсгэх:
```bash
mkdir /tmp/map && cd /tmp/map && npm i sharp
node <repo>/saleswaves.mn/v2.saleswaves.mn/tools/build-map.mjs <repo>/saleswaves.mn/v2.saleswaves.mn/wwwroot/assets/map
```
Замнал: Йокохама → (Осүми хоолой, Шар тэнгис, Бохай) → Тяньжин → Бээжин → Жанжакоу → Эрээн / Замын-Үүд →
Сайншанд → Чойр → Улаанбаатар. Зайг замналын цэгүүдээс тооцдог тул ойролцоо утга (≈) болно.

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
- CSS/JS файл засвал `index.html` болон `site.js` доторх `?v=` дугаарыг нэмэгдүүлнэ (хөтчийн кэш 7 хоног).
