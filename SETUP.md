# دليل الإعداد والنشر — MGX(PC)

## 1. إعداد Supabase (قاعدة البيانات + تسجيل الدخول)

1. أنشئ حساب/مشروع جديد مجاني على [supabase.com](https://supabase.com).
2. من **Authentication → Users → Add user** أنشئ مستخدم الأونر (بريد إلكتروني
   + كلمة مرور، وفعّل **Auto Confirm User**). هذا هو حساب الدخول لصفحة `/admin`.
3. من القائمة الجانبية افتح **SQL Editor** → New query وشغّل الملفات بالترتيب:
   1. `supabase/schema.sql` — الجداول الأساسية وبيانات تجريبية.
   2. `supabase/v2_catalog.sql` — كتالوج القطع، الأسعار، الفيديوهات، تجميعات الزوار، والحماية.
      **قبل التشغيل** غيّر `OWNER_EMAIL_HERE` لإيميل الأونر (الخطوة 2). الملف يضيفك لجدول
      `admins`، والكتابة على الموقع كلها مقصورة على هذا الجدول.
   راجع النتيجة في آخر المخرجات (`admins_count` لازم يكون 1 أو أكثر). التفاصيل في `supabase/README.md`.
   - لإضافة أدمن ثاني لاحقًا شوف قسم "Managing admins" في `supabase/README.md`.
4. من **Project Settings → API** انسخ:
   - `Project URL`
   - `anon public` key

5. **مهم:** من **Authentication → Sign In / Providers** أطفئ **Allow new users to sign up**،
   حتى ما يقدر أحد يسوي حساب في مشروعك.

## 2. ربط المشروع بـ Supabase محليًا

```bash
cp .env.example .env
```

افتح `.env` وضع القيم اللي نسختها:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxx
```

## 3. التشغيل محليًا

```bash
npm ci
npm run dev
```

افتح `http://localhost:5173/mgx-pc/`. يحتاج **Node 22** أو أحدث.

## 4. رفع المشروع على GitHub

```bash
git init
git add .
git commit -m "Initial commit: MGX(PC)"
git branch -M main
git remote add origin https://github.com/<username>/<repo-name>.git
git push -u origin main
```

> ملف `.env` مستثنى تلقائيًا من Git (موجود في `.gitignore`) — لا يترفع مع الكود.

## 5. النشر — اختر طريقة واحدة

### الخيار أ: GitHub Pages (تلقائي عبر GitHub Actions، بدون حساب خارجي)

المشروع فيه ملف جاهز `.github/workflows/deploy.yml` يبني الموقع وينشره
تلقائيًا كل مرة تعمل `push` على `main`. خطوات التفعيل (مرة وحدة فقط):

1. أضف مفاتيح Supabase كـ **Secrets** بالمستودع (مو بملف `.env` لأنه ما يترفع
   مع الكود): من صفحة المستودع على GitHub → **Settings → Secrets and
   variables → Actions → New repository secret**، أضف:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. فعّل المصدر: **Settings → Pages → Build and deployment → Source** اختر
   **GitHub Actions**.
3. أي `push` على `main` بعدين يشغّل الـ workflow تلقائيًا ويبني وينشر
   الموقع. تابع التقدم من تبويب **Actions** بالمستودع.
4. رابط الموقع يكون: `https://<username>.github.io/<repo-name>/`

> ملف `vite.config.ts` فيه `base: '/mgx-pc/'` معدّل مسبقًا ليطابق اسم
> المستودع. لو غيّرت اسم المستودع، لازم تعدّل هذا السطر بنفس الاسم الجديد.

### الخيار ب: Vercel (نشر أسرع، رابط أبسط)

1. سجّل دخول على [vercel.com](https://vercel.com) بحساب GitHub.
2. **Add New → Project** → اختر مستودع GitHub اللي رفعته.
3. Vercel يكتشف Vite تلقائيًا. قبل الضغط على Deploy، أضف متغيرات البيئة من
   **Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. اضغط **Deploy**. كل push جديد لـ `main` بعدين يحدّث الموقع تلقائيًا.

> لو اخترت Vercel، احذف أو عطّل ملف `.github/workflows/deploy.yml` تجنبًا
> لتشغيل نشرين بنفس الوقت لمستودع واحد (مو ضروري لكنه أنظف).

## إضافة متاجر جديدة

المتجرين الافتراضيين (Amazon, AliExpress) مزروعين بدون شعار. من تبويب
**المتاجر** بلوحة التحكم تقدر ترفع شعار لهم أو تضيف أي متجر جديد بشعاره.
