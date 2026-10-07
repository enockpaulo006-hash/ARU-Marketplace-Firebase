from django.urls import path

from .views import (
    UserLoginView,
    logout_view,
    profile_view,
    register_view,
    resend_otp_view,
    verify_otp_view,
)

app_name = "accounts"

urlpatterns = [
    path("register/", register_view, name="register"),
    path("login/", UserLoginView.as_view(), name="login"),
    path("logout/", logout_view, name="logout"),
    path("verify-otp/", verify_otp_view, name="verify_otp"),
    path("verify-otp/resend/", resend_otp_view, name="resend_otp"),
    path("profile/", profile_view, name="profile"),
]
