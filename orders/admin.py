from django.contrib import admin

from .models import Order


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "product", "buyer", "seller", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("product__title", "buyer__email", "seller__email", "buyer_phone")
    ordering = ("-created_at",)