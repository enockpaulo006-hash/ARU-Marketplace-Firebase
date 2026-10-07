from django.contrib import admin

from .models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("title", "seller", "category", "price", "status", "created_at")
    list_filter = ("category", "status", "product_condition", "created_at")
    search_fields = ("title", "description", "location", "seller__email", "seller__full_name")
    ordering = ("-created_at",)