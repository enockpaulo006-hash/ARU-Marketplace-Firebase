from datetime import timedelta

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone

from accounts.utils import seller_otp_required
from products.models import Product

from .forms import OrderRequestForm
from .models import Order


ORDER_LIST_VISIBILITY_DAYS = 7


@login_required
def order_create_view(request, product_id):
    product = get_object_or_404(Product, id=product_id, status="active")
    breadcrumbs = [
        {"label": "Home", "url": "/"},
        {"label": "Products", "url": reverse("products:list")},
        {"label": product.title, "url": reverse("products:detail", args=[product.pk])},
        {"label": "Order Request"},
    ]
    if product.seller == request.user:
        messages.error(request, "You cannot order your own product.")
        return redirect("products:detail", pk=product.id)

    if request.method == "POST":
        form = OrderRequestForm(request.POST)
        if form.is_valid():
            order = form.save(commit=False)
            order.product = product
            order.buyer = request.user
            order.seller = product.seller
            order.save()
            messages.success(request, "Your order request has been sent successfully.")
            return redirect("orders:my_orders")
    else:
        form = OrderRequestForm()

    return render(request, "orders/order_form.html", {"form": form, "product": product, "breadcrumbs": breadcrumbs})


@login_required
def my_orders_view(request):
    visible_since = timezone.now() - timedelta(days=ORDER_LIST_VISIBILITY_DAYS)
    orders = (
        Order.objects.filter(buyer=request.user, created_at__gte=visible_since)
        .select_related("product", "seller")
        .order_by("-created_at")
    )
    breadcrumbs = [
        {"label": "Home", "url": "/"},
        {"label": "My Orders"},
    ]
    return render(request, "orders/my_orders.html", {"orders": orders, "breadcrumbs": breadcrumbs})


@login_required
def order_update_view(request, pk):
    order = get_object_or_404(
        Order.objects.select_related("product"),
        pk=pk,
        buyer=request.user,
    )
    breadcrumbs = [
        {"label": "Home", "url": "/"},
        {"label": "My Orders", "url": reverse("orders:my_orders")},
        {"label": "Edit Order"},
    ]
    if not order.can_buyer_edit:
        messages.error(request, "You can edit your order only within 3 hours after posting it.")
        return redirect("orders:my_orders")

    if request.method == "POST":
        form = OrderRequestForm(request.POST, instance=order)
        if form.is_valid():
            form.save()
            messages.success(request, "Your order information was updated successfully.")
            return redirect("orders:my_orders")
    else:
        form = OrderRequestForm(instance=order)

    return render(request, "orders/order_edit.html", {"form": form, "order": order, "breadcrumbs": breadcrumbs})


@login_required
@seller_otp_required
def received_requests_view(request):
    visible_since = timezone.now() - timedelta(days=ORDER_LIST_VISIBILITY_DAYS)
    orders = (
        Order.objects.filter(seller=request.user, created_at__gte=visible_since)
        .select_related("product", "buyer")
        .order_by("-created_at")
    )
    breadcrumbs = [
        {"label": "Home", "url": "/"},
        {"label": "Received Requests"},
    ]
    return render(request, "orders/received_requests.html", {"orders": orders, "breadcrumbs": breadcrumbs})
