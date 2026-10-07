from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from allauth.account import views as account_views
from django.urls import include, path

from accounts.views import UserLoginView, logout_view, register_view
from core.views import health_check

urlpatterns = [
    path("healthz/", health_check, name="health_check"),
    path("admin/", admin.site.urls),
    path("accounts/login/", UserLoginView.as_view(), name="account_login"),
    path("accounts/logout/", logout_view, name="account_logout"),
    path("accounts/register/", register_view, name="account_signup"),
    path("accounts/password/reset/", account_views.password_reset, name="account_reset_password"),
    path(
        "accounts/password/reset/confirm/",
        account_views.confirm_password_reset_code,
        name="account_confirm_password_reset_code",
    ),
    path(
        "accounts/password/reset/complete/",
        account_views.complete_password_reset,
        name="account_complete_password_reset",
    ),
    path(
        "accounts/password/reset/done/",
        account_views.password_reset_from_key_done,
        name="account_password_reset_completed",
    ),
    path("", include("core.urls")),
    path("accounts/social/", include("allauth.socialaccount.providers.google.urls")),
    path("accounts/social/3rdparty/", include("allauth.socialaccount.urls")),
    path("accounts/", include("accounts.urls")),
    path("products/", include("products.urls")),
    path("orders/", include("orders.urls")),
    path("sales/", include("sales.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
