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

## Preview functional smoke

Preview deployment `dpl_EfTuzAedLqNacPGY5dzERktZoYAV` from commit `4d40920` reached `READY`. تسجيل الدخول بالحساب المصرّح به نجح، وظهرت لوحة التحكم بنفس بيانات Supabase الحالية. زر التصدير أنشأ ملف CSV في Downloads. تبويب الأوردرات ظهر وفيه البحث، فلتر الحالة، نموذج الإضافة، عرض 4 من 4 أوردر، وتأكيدات الحذف؛ لم يتم تنفيذ أي تغيير.

اختبار HTTP منخفض الحمل على Preview نفذ 20 طلبًا متتاليًا، وكلها عادت HTTP 200، بمتوسط 0.110 ثانية وأقصى 0.373 ثانية للصفحة الأولى. هذه نتيجة smoke وليست اختبار تحمل أو ضغط إنتاجي.

## Production RLS incident fix

تم تشخيص سبب رسالة `infinite recursion detected in policy for relation profiles`: سياسة قراءة profiles كانت تستعلم من profiles داخل شرط السياسة نفسه. طُبقت migration `20260816170000_fix_profiles_rls_recursion.sql` باستخدام helper آمن `is_current_user_owner()` لتجنب الاستعلام الذاتي.

بعد أول إعادة اختبار ظهر خطأ ثانوي لأن migration سابقة أغلقت `current_user_role()` رغم أن التطبيق الحالي يستدعيها. طُبقت migration `20260816171000_restore_authenticated_current_user_role.sql` لإغلاقها أمام anon والسماح بها للمستخدمين المسجلين فقط. بعد ذلك نجح تسجيل الدخول على `https://zaro-erp.vercel.app/` وظهرت لوحة التحكم والبيانات الحالية دون تعديل بيانات العمل.

## Owner Operations local smoke

بعد تطبيق migration `owner_operations_sections` وبناء النسخة المحلية، نجح تسجيل الدخول بحساب Owner. ظهر تبويب `تشغيل Owner` وفيه: 4 تنبيهات، مرتجعون مفتوحون 0، مصروفات معلقة 0، طلبات متأخرة 1، بطاقة الإغلاق اليومي، مركز التنبيهات، التقرير الشهري، زر نسخة JSON، نماذج العملاء والموردين والمرتجعات واعتماد المصاريف. لم يتم إدخال أو اعتماد أو إغلاق أي بيانات.

اختبار النسخة الاحتياطية المحلية نجح: تم إنشاء `zaro_backup_2026-08-17.json` وظهر مكتملًا في سجل التنزيلات. الاختبار محلي ولم يكتب شيئًا إلى Supabase.

## 2026-08-17 — Local Owner smoke after backup restore UI

- `npm run build`: passed; Vite output 446.67 kB JS / 124.90 kB gzip and 8.68 kB CSS / 2.32 kB gzip.
- Local preview `http://localhost:5174/`: HTTP 200.
- Owner login with `by06884@gmail.com`: succeeded; profile loaded as Owner without the previous profiles RLS recursion error.
- Owner Operations tab rendered successfully with alert center, daily close action, monthly report, JSON backup, JSON restore input, collection settlements, customers, suppliers, returns, and expense approvals.
- Production data observed read-only during this smoke test: 4 orders, 1 delivered, 1 returned, 4 alerts, 2 open collection differences.
- No production data was changed during this smoke test.
