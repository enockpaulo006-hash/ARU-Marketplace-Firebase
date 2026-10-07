# Generated for Render deployment performance tuning.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0001_initial"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="product",
            index=models.Index(
                fields=["status", "-created_at"],
                name="product_status_created_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="product",
            index=models.Index(
                fields=["category", "status"],
                name="product_category_status_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="product",
            index=models.Index(
                fields=["seller", "status"],
                name="product_seller_status_idx",
            ),
        ),
    ]
