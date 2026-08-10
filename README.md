# ZARO Business System — نسخة قاعدة بيانات مشتركة (Supabase)

## الخطوات

### 1) Supabase (قاعدة البيانات)
1. اعمل حساب على supabase.com
2. اعمل Project جديد
3. من SQL Editor، شغّل الكود اللي في ملف `supabase_setup.sql` (مرة واحدة بس)
4. من Project Settings → API، انسخ الـ `Project URL` والـ `anon public key`
5. افتح `src/supabaseClient.js` وحط القيمتين مكان `PASTE_YOUR_PROJECT_URL_HERE` و `PASTE_YOUR_ANON_KEY_HERE`

### 2) النشر (GitHub + Vercel)
1. ارفع كل الملفات دي على Repository جديد في GitHub (حافظ على شكل الفولدرات)
2. من Vercel: Add New → Project → استورد الـ Repository → Deploy
3. هتاخد رابط ثابت أي حد يفتحه ويشتغل على نفس البيانات لحظيًا

## ملاحظات مهمة

- **البيانات مشتركة للجميع** — أي حد عنده الرابط يقدر يشوف ويعدّل. مفيش تسجيل دخول أو باسورد في النسخة دي. لو محتاج تقييد الوصول (باسورد أو حسابات مستخدمين)، قولّي وأضيفها.
- التحديثات بتظهر لحظيًا لكل اللي فاتحين الموقع في نفس الوقت (real-time).
- لو الرابط اتسرب لحد برا الشركة، هيقدر يعدّل على بياناتك — احتفظ بيه لنفسك وفريقك بس.

## التشغيل على جهازك (اختياري)

```bash
npm install
npm run dev
```

