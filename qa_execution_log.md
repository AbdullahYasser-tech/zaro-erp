# QA execution log

## Baseline

- Commit baseline before this QA pass: `3aecc7f`.
- `npm run build`: passed.
- Initial `npm audit --omit=dev`: one high vulnerability in direct dependency `xlsx` (prototype pollution and ReDoS advisories).
- Removed `xlsx` and replaced export path with UTF-8 CSV compatible with Excel. After removal, build passed and production dependency audit reported 0 vulnerabilities.
- Local browser smoke after dependency removal reached a persistent loading state; no explicit Console error was shown. This is not accepted as a pass until isolated. The Vercel preview from the previous commit had passed login/dashboard smoke.

## Safety

No production write was performed. No order, product, expense, invitation, or inventory movement was created during this QA pass.

## Retest results

بعد إضافة imports الصريحة في `AuthGate.jsx` و`main.jsx` اختفت شاشة التحميل المحلية، وظهرت لوحة التحكم بنجاح. تم الضغط على زر التصدير، وظهر ملف `zaro_business_system_2026-08-16.csv` في Downloads. الفحص البرمجي أكد وجود UTF-8 BOM، وعناوين Dashboard والأوردرات، و78 سطرًا من البيانات.

تمت إزالة `xlsx` من `package.json` و`package-lock.json`. build النهائي مرّ بنجاح، وحجم JavaScript انخفض من نحو 709 kB إلى نحو 425 kB، و`npm audit --omit=dev` أصبح بلا ثغرات.

فحص Supabase القراءة فقط أعاد عدد سجلات `audit_logs` = 0، وهو متوقع لأن اختبار QA لم ينفذ أي كتابة. لا تزال اختبارات RLS لكل دور، والضغط، والاسترجاع، والانقطاع، وmigration rollback بحاجة إلى بيئة اختبار Supabase منفصلة حتى لا تمس بيانات الإنتاج.
