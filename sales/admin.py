from django.contrib import admin

from .models import Sale, SellerPayment


@admin.register(SellerPayment)
class SellerPaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "seller", "amount_paid", "status", "paid_at", "verified_at")
    list_filter = ("status", "paid_at", "verified_at")
    search_fields = ("seller__email", "seller__full_name", "payment_reference")
    ordering = ("-created_at",)


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ("id", "product", "seller", "buyer", "sale_amount", "platform_fee", "fee_status", "completed_at")
    list_filter = ("fee_status", "completed_at")
    search_fields = ("product__title", "seller__email", "buyer__email")
    ordering = ("-completed_at",)