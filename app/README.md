This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Plan

Lên kế hoạch thực hiện api **search**: nhận vào user query, optional tọa độ => trả về list các quán có kèm món theo yêu cầu.

Từ query user nhận biết 6 yếu tố

1. User muốn tìm đồ ăn hay giải khát (bao gồm cả chè, kem, sữa chua...) hay ko xác định
2. User có yêu cầu tìm những món ăn nào (mảng có values hoặc trống)
3. User yêu cầu quán có những vibe tags nào (mảng có values giới hạn trong bảng tags hoặc trống)
4. User có yêu cầu địa điểm ko (mặc định giới hạn quán trong khoảng cách 1.5km nếu có địa điểm)
5. User có yêu cầu về giá ko (lọc những món có giá <= giá yêu cầu)
6. User có yêu cầu rẻ ko (nếu có thì phần ranking sẽ thêm trọng số cho quán có món theo yêu cầu rẻ)

Rankink kết quả trả về theo độ gần, rating/rating_count, và độ match các vibe tags, thêm giá rẻ nếu có yêu cầu.

Lọc cứng trong DB sẽ sử dụng các yếu tố  1,2,4,5. Yếu tố 3, 6 sẽ ảnh hưởng trong phần rankink kết quả trả về.

Tham khảo cách làm trong code cũ, viết vào file trong thư mục plans để mình confirm và chỉnh sửa.
