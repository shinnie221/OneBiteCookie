# One Bite: 30s website promo

`one-bite-promo.mp4`: H.264 High, 1920×1080, 30 fps, 30.0 s, AAC stereo 48 kHz audio at -16 LUFS, about 19 MB. Re-shot on 2026-10-28 against the current site (new prices and the cookie-slot BYOB modal).

## Audio

The soundtrack is original and synthesized by [`scripts/music.py`](scripts/music.py) using numpy only, with no samples or licensed audio, so it is royalty-free.

It's a calm lo-fi bed in F major at 96 BPM: a warm pad, a Rhodes-style arpeggio and a soft bass. The pieces are timed to the picture:
- Bell glint as the logo writes on (about 1.2 s).
- Soft beat and a whoosh come in when the browser window rises (3.75 s).
- Click sounds on each cursor click (13.0, 15.8, 20.55 and 25.85 s).
- The beat drops out with a whoosh at the end card (26.25 s), then a rolled closing chord and a bell glint on the end logo. The track fades out over the last 1.2 s.

All UI in the video comes from real screenshots of the local storefront (desktop 1440×900 at 2×). These were taken while browsing as a guest. The cart was filled through browser localStorage only. Nothing was written to the app's data.

## Shot list

| Time | Shot | On screen |
|---|---|---|
| 0.0–4.0 | **Brand intro** | Cookie icon spins in, then moves into the "One Bite" script logo as the logo wipes on. "HANDCRAFTED COOKIES" with rules either side, then "Order online · Pickup or delivery". The shop's own transparent cookie cutouts float in the corners. |
| 4.0–7.3 | **Storefront** | A browser window (onebitecookie.com) rises in, showing the home page (announcement bar, nav, hero banner, round logo, cookie grid). Caption: "Freshly baked, beautifully online." |
| 7.3–9.6 | **Announcement bar** | The camera zooms onto the top bar and highlights "Next delivery & pickup date: 25 October 2026 11am-2pm". Caption: "Never miss a bake day." |
| 9.6–13.4 | **Menu** | The page scrolls down to the Cookies grid. On the left, the five flavors appear one by one with cookie-cutout thumbnails (Strawberry White Choc, Red Velvet White Choc, Classic Chocolate Chip, Toasted Marshmallow, Biscoff Walnut), then "From RM8.90 per piece". A cursor clicks Strawberry White Choc. |
| 13.4–18.2 | **Product view** | The product overlay opens and the camera zooms to the options. The cursor picks "Box of 6", which gets a highlight, and the button changes to "Add to Cart · RM53.00". On the left, matching price chips: Per piece RM8.90 / Box of 4 RM35 / Box of 6 RM53 / Box of 12 RM105. |
| 18.2–22.6 | **Build Your Own Box** | The side-by-side BYOB modal (5 Pieces "Try All 5", RM44 selected). The cursor clicks "1 of Each" and the five empty cookie slots fill with cookie cutouts, showing "Box is full (5/5)", with a highlight. Caption: "Mix & match your favorites." |
| 22.6–26.3 | **Cart & checkout** | The cart page with a Box of 6, 2× Red Velvet and a BYOB box of 5 (total RM114.80), then the cursor clicks "Login to Checkout". Cards: "Pickup: Collect in Setapak, Kuala Lumpur" and "Delivery: Delivered within Kuala Lumpur". |
| 26.3–30.0 | **Call to action** | The scene fades to dark brown. The white logo wipes on, then "One Bite is all it takes.", an "Order Now" pill, and "Pickup · Delivery in Kuala Lumpur". It holds to the end. |

## Notes

- The checkout page needs a sign-in, so it isn't screenshotted. Pickup and delivery appear as motion-graphic cards, and their wording comes from the checkout page.
- `onebitecookie.com` appears only in the browser window's address bar. It's the default base URL in `src/lib/email.js`; change it in `scene.html` if the live domain is different.
- The website's Home page plays this video above the menu ("One Bite in 30 Seconds"). It uses a smaller web encode at `public/videos/one-bite-promo.mp4` with a poster frame. Re-export both when this video changes (see below).

## Re-rendering

`scene.html` is a deterministic timeline: `window.seek(t)` paints the frame at time `t`. The scripts need `puppeteer-core` (they drive the installed Chrome) and an ffmpeg binary:

```bash
npm i puppeteer-core            # in a scratch folder next to the scripts
node scripts/capture.mjs <outDir>   # needs `npm run dev` on :3000; re-shoot screenshots
node scripts/render.mjs scene.html one-bite-promo.mp4 <path-to-ffmpeg>
```

To add the audio, generate the WAV and mux it onto the silent render:

```bash
python scripts/music.py music.wav
ffmpeg -i silent.mp4 -i music.wav -map 0:v -map 1:a -c:v copy -af volume=-2.6dB -c:a aac -b:a 192k -shortest -movflags +faststart one-bite-promo.mp4
```

`capture.mjs` saves PNGs. Convert the ones the scene uses to `assets/*.jpg` (quality 92) before rendering. The cart is seeded with live prices from `/api/products`. The `assets/cutout-*.png` files are the products' `cutout_image` files, trimmed and resized to 640 px.

For the website copy, make a web-sized encode and a poster frame (the intro logo at 3 s):

```bash
ffmpeg -i one-bite-promo.mp4 -c:v libx264 -preset slow -crf 26 -c:a aac -b:a 128k -movflags +faststart ../public/videos/one-bite-promo.mp4
ffmpeg -ss 3 -i one-bite-promo.mp4 -frames:v 1 -q:v 3 ../public/videos/one-bite-promo-poster.jpg
```
