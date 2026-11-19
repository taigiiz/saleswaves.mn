# v2.saleswaves.mn

Three.js дээр бүтээсэн, build алхамгүй статик вэб сайт (HTML + CSS + JS).

## Бүтэц
- `index.html` — бүх хэсэг (MN үндсэн, EN орчуулга `assets/i18n.js`)
- `assets/scene.js` — WebGL: давалгаат бөөм талбай + цэгэн дэлхийн бөмбөрцөг, Япон → Тяньжин → Замын-Үүд → Улаанбаатар маршрут
- `assets/ui.js` — loader, хөдөлгөөн, гүйлгэлтийн төлөв, хэл солих, холбоо барих маягт
- `assets/land.b64` — Natural Earth (world-atlas 110m) өгөгдлөөс үүсгэсэн газрын цэгүүд
- `assets/vendor/` — three.js r170, GSAP 3.12 (локал, CDN-гүй)

## Локал ажиллуулах
```bash
cd v2 && python3 -m http.server 8080
```

## Байршуулах
`v2/` хавтсыг ямар ч статик хостинг (IIS, Nginx, Cloudflare Pages, Netlify г.м.) дээр
`v2.saleswaves.mn` домэйнд шууд тавихад болно.

## Анхаарах
- Холбоо барих маягт одоогоор хэрэглэгчийн имэйл програмыг (`mailto:info@saleswaves.mn`) нээдэг.
  Шууд илгээдэг болгохын тулд backend endpoint (жишээ нь одоогийн ASP.NET-ийн EmailService) холбох хэрэгтэй.
- Статистик тоонууд (1053, 54 г.м.) одоогийн сайтаас авсан статик утга.
- WebGL дэмжихгүй төхөөрөмж дээр градиент дэвсгэр рүү автоматаар шилжинэ; `prefers-reduced-motion` дэмжинэ.
