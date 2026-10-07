from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone

from accounts.utils import seller_otp_required
from orders.models import Order
from products.models import Product

from .forms import CompleteSaleForm
from .models import Sale


@login_required
@seller_otp_required
def complete_sale_view(request, order_id):
    order = get_object_or_404(
        Order.objects.select_related("product", "buyer", "seller"),
        id=order_id,
        seller=request.user,
    )
    breadcrumbs = [
        {"label": "Home", "url": "/"},
        {"label": "Received Requests", "url": reverse("orders:received_requests")},
        {"label": "Complete Sale"},
    ]
    if order.status == "cancelled":
        messages.error(request, "You cannot complete a cancelled order.")
        return redirect("orders:received_requests")

    if Sale.objects.filter(order=order).exists():
        messages.error(request, "A sale record already exists for this order.")
        return redirect("orders:received_requests")

    if request.method == "POST":
        form = CompleteSaleForm(request.POST)
        if form.is_valid():
            sale = Sale.objects.create(
                order=order,
                product=order.product,
                seller=order.seller,
                buyer=order.buyer,
                sale_amount=form.cleaned_data["sale_amount"],
                platform_fee=settings.PLATFORM_FEE,
                completed_at=timezone.now(),
            )

            order.status = "completed"
            order.save(update_fields=["status", "updated_at"])

            product = order.product
            product.status = "sold"
            product.save(update_fields=["status", "updated_at"])

            messages.success(request, "Sale completed successfully and recorded.")
            return redirect("orders:received_requests")
    else:
        form = CompleteSaleForm()

    return render(request, "sales/complete_sale.html", {"form": form, "order": order, "breadcrumbs": breadcrumbs})
