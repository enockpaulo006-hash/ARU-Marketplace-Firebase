from django.urls import path

from .views import complete_sale_view

app_name = "sales"

urlpatterns = [
    path("complete-sale/<int:order_id>/", complete_sale_view, name="complete_sale"),
]
