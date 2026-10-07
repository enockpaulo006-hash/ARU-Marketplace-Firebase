from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from orders.models import Order
from products.models import Product


class SellerPayment(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("verified", "Verified"),
        ("rejected", "Rejected"),
    )

    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="seller_payments",
    )
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    payment_reference = models.CharField(max_length=100, blank=True)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    paid_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by_admin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verified_payments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["seller", "status"], name="payment_seller_status_idx"),
            models.Index(fields=["status", "-created_at"], name="payment_status_created_idx"),
        ]

    def __str__(self):
        return f"Payment #{self.id} - {self.seller.email}"


class Sale(models.Model):
    FEE_STATUS_CHOICES = (
        ("unpaid", "Unpaid"),
        ("paid", "Paid"),
        ("verified", "Verified"),
    )

    order = models.OneToOneField(
        Order,
        on_delete=models.CASCADE,
        related_name="sale",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="sales",
    )
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sales_made",
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="purchases",
    )
    sale_amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    platform_fee = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    fee_status = models.CharField(max_length=10, choices=FEE_STATUS_CHOICES, default="unpaid")
    payment_record = models.ForeignKey(
        SellerPayment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sales",
    )
    completed_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-completed_at", "-created_at"]
        indexes = [
            models.Index(fields=["seller", "-completed_at"], name="sale_seller_completed_idx"),
            models.Index(fields=["buyer", "-completed_at"], name="sale_buyer_completed_idx"),
            models.Index(fields=["fee_status", "-completed_at"], name="sale_fee_completed_idx"),
        ]

    def __str__(self):
        return f"Sale #{self.id} - {self.product.title}"
