import logging

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.conf import settings
from django.core.paginator import Paginator
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.http import require_POST

from accounts.utils import seller_otp_required
from .forms import ProductForm, ProductFormSet
from .models import Product


logger = logging.getLogger(__name__)


def product_list_view(request):
    query = request.GET.get("q", "").strip()
    selected_category = request.GET.get("category", "")

    products_queryset = Product.objects.filter(status="active").select_related("seller")

    if query:
        products_queryset = products_queryset.filter(
            Q(title__icontains=query)
            | Q(description__icontains=query)
            | Q(location__icontains=query)
        )

    if selected_category:
        products_queryset = products_queryset.filter(category=selected_category)

    category_counts = {
        row["category"]: row["total"]
        for row in Product.objects.filter(status="active")
        .values("category")
        .annotate(total=Count("id"))
    }

    category_meta = {
        "electronics": {
            "icon": "💻",
            "subtitle": "Laptops, gadgets, and hardware",
        },
        "phones_accessories": {
            "icon": "📱",
            "subtitle": "Phones, chargers, and cases",
        },
        "books_notes": {
            "icon": "📚",
            "subtitle": "Textbooks, notes, and study guides",
        },
        "fashion": {
            "icon": "👗",
            "subtitle": "Clothing, shoes, and accessories",
        },
        "hostel_items": {
            "icon": "🏠",
            "subtitle": "Dorm supplies and room essentials",
        },
        "services": {
            "icon": "🛠️",
            "subtitle": "Tutoring, delivery, and repairs",
        },
        "other": {
            "icon": "🔖",
            "subtitle": "Unique finds and general listings",
        },
    }

    categories = []
    for code, label in Product.CATEGORY_CHOICES:
        categories.append(
            {
                "code": code,
                "label": label,
                "count": category_counts.get(code, 0),
                "icon": category_meta.get(code, {}).get("icon", "🔹"),
                "subtitle": category_meta.get(code, {}).get(
                    "subtitle", "Browse products by category"
                ),
            }
        )

    selected_category_label = None
    if selected_category:
        selected_category_label = next(
            (category["label"] for category in categories if category["code"] == selected_category),
            None,
        )

    paginator = Paginator(products_queryset, settings.PRODUCTS_PER_PAGE)
    page_obj = paginator.get_page(request.GET.get("page"))
    page_query_params = request.GET.copy()
    page_query_params.pop("page", None)

    context = {
        "products": page_obj.object_list,
        "page_obj": page_obj,
        "total_products": paginator.count,
        "page_query": page_query_params.urlencode(),
        "categories": categories,
        "query": query,
        "selected_category": selected_category,
        "selected_category_label": selected_category_label,
        "breadcrumbs": [
            {"label": "Home", "url": "/"},
            {"label": "Products"},
        ],
    }
    return render(request, "products/product_list.html", context)


def product_detail_view(request, pk):
    product = get_object_or_404(Product.objects.select_related("seller"), pk=pk, status="active")
    breadcrumbs = [
        {"label": "Home", "url": "/"},
        {"label": "Products", "url": reverse("products:list")},
        {"label": product.title},
    ]
    return render(request, "products/product_detail.html", {"product": product, "breadcrumbs": breadcrumbs})


@login_required
@seller_otp_required
def product_create_view(request):
    breadcrumbs = [
        {"label": "Home", "url": "/"},
        {"label": "My Products", "url": reverse("products:my_products")},
        {"label": "Post Product"},
    ]
    if request.method == "POST":
        formset = ProductFormSet(request.POST, request.FILES, prefix="products")
        if formset.is_valid():
            created_products = 0

            try:
                for form in formset:
                    if not form.cleaned_data:
                        continue

                    product = form.save(commit=False)
                    product.seller = request.user
                    product.save()
                    created_products += 1
            except Exception:
                logger.exception("Failed to save product or upload product image.")
                messages.error(
                    request,
                    "We could not upload the product image right now. Please check the image storage settings and try again.",
                )
                return render(
                    request,
                    "products/product_form.html",
                    {"formset": formset, "breadcrumbs": breadcrumbs},
                )

            if created_products == 1:
                messages.success(request, "Your product has been posted successfully.")
            else:
                messages.success(
                    request,
                    f"{created_products} products have been posted successfully.",
                )
            return redirect("products:my_products")
    else:
        formset = ProductFormSet(prefix="products")

    return render(
        request,
        "products/product_form.html",
        {"formset": formset, "breadcrumbs": breadcrumbs},
    )


@login_required
@seller_otp_required
def my_products_view(request):
    products = Product.objects.filter(seller=request.user).order_by("-created_at")
    breadcrumbs = [
        {"label": "Home", "url": "/"},
        {"label": "My Products"},
    ]
    return render(request, "products/my_products.html", {"products": products, "breadcrumbs": breadcrumbs})


@login_required
@seller_otp_required
def product_update_view(request, pk):
    product = get_object_or_404(Product, pk=pk, seller=request.user)
    breadcrumbs = [
        {"label": "Home", "url": "/"},
        {"label": "My Products", "url": reverse("products:my_products")},
        {"label": "Edit Product"},
    ]

    if request.method == "POST":
        form = ProductForm(request.POST, request.FILES, instance=product)
        if form.is_valid():
            try:
                form.save()
            except Exception:
                logger.exception("Failed to update product or upload product image.")
                messages.error(
                    request,
                    "We could not upload the product image right now. Please check the image storage settings and try again.",
                )
                return render(request, "products/product_edit.html", {"form": form, "product": product, "breadcrumbs": breadcrumbs})
            messages.success(request, "Your product has been updated successfully.")
            return redirect("products:my_products")
    else:
        form = ProductForm(instance=product)

    return render(request, "products/product_edit.html", {"form": form, "product": product, "breadcrumbs": breadcrumbs})


@login_required
@seller_otp_required
@require_POST
def product_delete_view(request, pk):
    product = get_object_or_404(Product, pk=pk, seller=request.user)
    product_title = product.title
    product.delete()
    messages.success(request, f'"{product_title}" has been deleted successfully.')
    return redirect("products:my_products")
