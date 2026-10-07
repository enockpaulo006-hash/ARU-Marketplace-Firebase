from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.db.models import Count
from django.shortcuts import render

from products.models import Product


def health_check(request):
    return JsonResponse({"status": "ok"})


def home(request):
    active_products = Product.objects.filter(status="active")
    featured_products = list(active_products.select_related("seller")[:6])
    category_totals = {
        row["category"]: row["total"]
        for row in active_products.values("category").annotate(total=Count("id"))
    }

    category_spotlights = [
        {
            "label": "Electronics",
            "count": category_totals.get("electronics", 0),
            "description": "Laptops, earphones, calculators, and study tech ready for campus life.",
        },
        {
            "label": "Phones & Accessories",
            "count": category_totals.get("phones_accessories", 0),
            "description": "Chargers, phones, covers, and small accessories students need every day.",
        },
        {
            "label": "Books & Notes",
            "count": category_totals.get("books_notes", 0),
            "description": "Revision notes, textbooks, and course materials shared student to student.",
        },
        {
            "label": "Hostel Items",
            "count": category_totals.get("hostel_items", 0),
            "description": "Daily essentials that make moving into hostel or off-campus housing easier.",
        },
    ]

    stats = {
        "active_products": active_products.count(),
        "student_sellers": get_user_model().objects.filter(products__status="active").distinct().count(),
        "campus_categories": len(Product.CATEGORY_CHOICES),
    }

    return render(
        request,
        "core/home.html",
        {
            "featured_products": featured_products,
            "category_spotlights": category_spotlights,
            "stats": stats,
        },
    )
