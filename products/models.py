from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class Product(models.Model):
    CATEGORY_CHOICES = (
        ("electronics", "Electronics"),
        ("phones_accessories", "Phones & Accessories"),
        ("books_notes", "Books & Notes"),
        ("fashion", "Fashion"),
        ("hostel_items", "Hostel Items"),
        ("services", "Services"),
        ("other", "Other"),
    )

    CONDITION_CHOICES = (
        ("new", "New"),
        ("used", "Used"),
    )

    STATUS_CHOICES = (
        ("active", "Active"),
        ("hidden", "Hidden"),
        ("sold", "Sold"),
    )

    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="products",
    )
    title = models.CharField(max_length=200)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    price = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    description = models.TextField()
    image = models.ImageField(upload_to="products/")
    product_condition = models.CharField(max_length=10, choices=CONDITION_CHOICES)
    location = models.CharField(max_length=150)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"], name="product_status_created_idx"),
            models.Index(fields=["category", "status"], name="product_category_status_idx"),
            models.Index(fields=["seller", "status"], name="product_seller_status_idx"),
        ]

    def __str__(self):
        return self.title
