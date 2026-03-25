# Game Ban Na FPS (Web)

Game ban "na" don gian theo goc nhin thu nhat, co mo phong vat ly co ban:
- Goc ban theo huong camera (pitch + yaw).
- Luc ban theo thoi gian giu chuot.
- Co thanh force bar de can luc keo.
- Trong luc, luc can khong khi va do nay khi cham dat.
- Muc tieu la 1 bia hinh nom dung im (dat gan hon) de tap canh luc/goc ban.
- Co khung zoom tron de theo doi vung vua ban trung tren hinh nom.
- Co the import anh 2D va dan vao mat truoc hinh nom.
- Dan duoc mo phong nhu chat long, trung dich se no giot va de lai vet mau.

## Cong nghe

- Vite
- Three.js

Phu hop deploy Vercel theo kieu static frontend.

## Chay local

```bash
npm install
npm run dev
```

Mo `http://localhost:5173`.

## Dieu khien

- Click vao man hinh: bat Pointer Lock
- Di chuot: thay doi huong nhin / goc ban
- `W A S D`: di chuyen
- `Shift`: chay nhanh
- Giu chuot trai: tang luc keo na
- Tha chuot trai: ban
- `ESC`: thoat Pointer Lock de chon/xoa anh hinh nom
- `R`: reset diem

## Build

```bash
npm run build
npm run preview
```

## Deploy Vercel

Repo da co `vercel.json`:

```json
{
  "framework": "vite"
}
```

Chi can import repo vao Vercel, Vercel se tu dong nhan dien Vite va deploy.
