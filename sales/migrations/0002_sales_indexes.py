# Generated for Render deployment performance tuning.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0001_initial"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="sellerpayment",
            index=models.Index(
                fields=["seller", "status"],
                name="payment_seller_status_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="sellerpayment",
            index=models.Index(
                fields=["status", "-created_at"],
                name="payment_status_created_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="sale",
            index=models.Index(
                fields=["seller", "-completed_at"],
                name="sale_seller_completed_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="sale",
            index=models.Index(
                fields=["buyer", "-completed_at"],
                name="sale_buyer_completed_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="sale",
            index=models.Index(
                fields=["fee_status", "-completed_at"],
                name="sale_fee_completed_idx",
            ),
        ),
    ]
