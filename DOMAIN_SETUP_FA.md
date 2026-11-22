# راه‌اندازی دامنهٔ اختصاصی و HTTPS برای نور قرآن

دامنهٔ اختصاصی هنوز روی مخزن تنظیم نشده است؛ این فایل آماده‌سازی فنی است و به‌معنای ثبت دامنه یا تغییر DNS نیست. فقط دامنه‌ای را وارد کن که مالک آن هستی یا اجازهٔ مدیریت DNS آن را داری.

## ترتیب امن راه‌اندازی
1. در GitHub، دامنه را از مسیر **حساب کاربری → Settings → Pages → Add a domain** تأیید کن. رکورد TXT اختصاصی‌ای را که GitHub نمایش می‌دهد در پنل DNS ثبت کن و تا پایان تأیید نگه دار.
2. در مخزن `ngodstar9-lab/site-cs2` به **Settings → Pages → Custom domain** برو و دامنهٔ تأییدشده را وارد کن.
3. برای دامنهٔ ریشه مانند `example.ir`، رکوردهای A زیر را برای میزبان `@` ثبت کن:
```text
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```
رکوردهای AAAA برای IPv6 (اختیاری):
```text
2606:50c0:8000::153
2606:50c0:8001::153
2606:50c0:8002::153
2606:50c0:8003::153
```
برای زیردامنهٔ `www.example.ir` یک CNAME ثبت کن:
```text
www  CNAME  ngodstar9-lab.github.io.
```
4. پس از انتشار DNS، در **Settings → Pages** فعال‌شدن گواهی را بررسی و گزینهٔ **Enforce HTTPS** را روشن کن. انتشار DNS و صدور گواهی ممکن است زمان ببرد.
5. بعد از فعال‌شدن دامنه، نشانی canonical صفحهٔ اصلی، حریم خصوصی و دانلود، فایل sitemap و پیوندهای شبکه‌های اجتماعی باید با دامنهٔ نهایی به‌روزرسانی شوند. تا قبل از انتخاب دامنه، این فایل‌ها عمداً با نشانی فعلی GitHub Pages باقی مانده‌اند.

## نکات
- هیچ نام دامنهٔ فرضی در فایل `CNAME` ثبت نشده است.
- رکوردهای A/AAAA یا CNAME متناقض قدیمی را بررسی کن و از wildcard DNS مانند `*.example.ir` استفاده نکن.
- مستندات رسمی:
  - https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
  - https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
