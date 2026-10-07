from django.urls import path

from .views import (
    my_products_view,
    product_create_view,
    product_delete_view,
    product_detail_view,
    product_list_view,
    product_update_view,
)

app_name = "products"

urlpatterns = [
    path("", product_list_view, name="list"),
    path("create/", product_create_view, name="create"),
    path("my-products/", my_products_view, name="my_products"),
    path("<int:pk>/edit/", product_update_view, name="edit"),
    path("<int:pk>/delete/", product_delete_view, name="delete"),
    path("<int:pk>/", product_detail_view, name="detail"),
]
