# Render Deployment Notes

This project is prepared for Render as a Django web service.

## Render settings

- Build command: `pip install -r requirements.txt && python manage.py collectstatic --no-input && python manage.py migrate`
- Start command: `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 60`
- Health check path: `/healthz/`

## Required environment variables

Set these in Render if you are not using `render.yaml`:

```txt
SECRET_KEY=<generate a secure value>
DEBUG=False
ALLOWED_HOSTS=<your-service-name>.onrender.com
CSRF_TRUSTED_ORIGINS=https://<your-service-name>.onrender.com
DATABASE_URL=<Render Postgres internal connection string>
```

Optional tuning values:

```txt
DB_CONN_MAX_AGE=600
PRODUCTS_PER_PAGE=12
PRODUCT_IMAGE_MAX_WIDTH=1200
PRODUCT_IMAGE_MAX_HEIGHT=1200
PRODUCT_IMAGE_QUALITY=82
SELLER_OTP_ENABLED=False
CLOUDINARY_URL=<your Cloudinary API environment variable>
EMAIL_TIMEOUT=5
EMAIL_BACKEND=accounts.email_backends.ResendEmailBackend
RESEND_API_KEY=<your Resend API key>
RESEND_FROM_EMAIL=ARUMarket <onboarding@resend.dev>
```

## Uploaded product images

New uploads are compressed automatically by the product form.

To check existing images before launch:

```bash
python manage.py optimize_product_images --dry-run
```

To optimize existing images:

```bash
python manage.py optimize_product_images
```

Render's normal filesystem is temporary. For permanent user uploads, use a persistent disk on a paid Render service or cloud storage such as S3/Cloudinary.

## Product Images

For Render Free, use Cloudinary for uploaded product images:

1. Create a Cloudinary account.
2. In Cloudinary, copy the API environment variable. It looks like `cloudinary://API_KEY:API_SECRET@CLOUD_NAME`.
3. In Render, set `CLOUDINARY_URL` to that full value.
4. Redeploy the service.

When `CLOUDINARY_URL` is set, uploaded product images are stored in Cloudinary and `{{ product.image.url }}` will render a Cloudinary HTTPS image URL. Existing products that were uploaded before Cloudinary was enabled may need their images uploaded again.

Do not commit local uploaded media, browser cache folders, SQLite databases, or Python bytecode. They make Render deploys larger and can accidentally publish local-only data.

## Email OTP

The app now supports the Resend HTTPS email API for OTP emails. This avoids SMTP ports, which are blocked on Render Free services.

Set these environment variables on the `student-marketplace` web service:

```txt
EMAIL_BACKEND=accounts.email_backends.ResendEmailBackend
RESEND_API_KEY=<your Resend API key>
RESEND_FROM_EMAIL=ARUMarket <onboarding@resend.dev>
```

For real users, verify your domain in Resend and change `RESEND_FROM_EMAIL` to an address on that domain. Keep `EMAIL_BACKEND` set to `accounts.email_backends.ResendEmailBackend` on Render Free so the app uses HTTPS instead of SMTP.

## Free plan cold starts

Render Free services can sleep after inactivity. Code changes cannot remove that delay; use a paid Render plan or an external monitor if startup delay is unacceptable.
