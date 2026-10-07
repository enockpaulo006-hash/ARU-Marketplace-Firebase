# Generated for Render deployment performance tuning.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0001_initial"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="order",
            index=models.Index(
                fields=["buyer", "-created_at"],
                name="order_buyer_created_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="order",
            index=models.Index(
                fields=["seller", "-created_at"],
                name="order_seller_created_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="order",
            index=models.Index(
                fields=["status", "-created_at"],
                name="order_status_created_idx",
            ),
        ),
    ]
