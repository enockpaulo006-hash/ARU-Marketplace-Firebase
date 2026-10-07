from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from products.models import Product


class Order(models.Model):
    EDIT_WINDOW_HOURS = 3
    STATUS_CHOICES = (
        ("new", "New"),
        ("seen", "Seen"),
        ("contacted", "Contacted"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="orders",
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="orders_made",
    )
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="orders_received",
    )
    buyer_phone = models.CharField(max_length=20)
    order_message = models.TextField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="new")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["buyer", "-created_at"], name="order_buyer_created_idx"),
            models.Index(fields=["seller", "-created_at"], name="order_seller_created_idx"),
            models.Index(fields=["status", "-created_at"], name="order_status_created_idx"),
        ]

    def __str__(self):
        return f"Order #{self.id} - {self.product.title}"

    @property
    def edit_deadline(self):
        return self.created_at + timedelta(hours=self.EDIT_WINDOW_HOURS)

    @property
    def can_buyer_edit(self):
        return timezone.now() <= self.edit_deadline
