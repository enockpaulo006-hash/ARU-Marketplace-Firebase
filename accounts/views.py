from django.conf import settings
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import LoginView
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils import timezone

from .forms import (
    OTPVerificationForm,
    ProfileUpdateForm,
    UserLoginForm,
    UserRegisterForm,
)
from .utils import (
    LOGIN_FAILED_ATTEMPTS_KEY,
    LOGIN_LOCKOUT_MINUTES,
    LOGIN_LOCKOUT_UNTIL_KEY,
    MAX_LOGIN_ATTEMPTS,
    MAX_OTP_ATTEMPTS,
    OTP_ATTEMPTS_KEY,
    OTP_EXPIRES_KEY,
    OTP_NEXT_KEY,
    OTP_SESSION_KEY,
    OTP_VERIFIED_KEY,
    has_pending_seller_otp,
    increment_login_failures,
    is_login_locked_out,
    send_seller_otp_code,
)


def register_view(request):
    if request.user.is_authenticated:
        return redirect("core:home")

    if request.method == "POST":
        form = UserRegisterForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data["password"])
            user.save()
            authenticated_user = authenticate(
                request,
                email=user.email,
                password=form.cleaned_data["password"],
            )
            messages.success(request, "Your account has been created successfully.")
            if authenticated_user is not None:
                login(request, authenticated_user)
            return redirect("core:home")
        else:
            messages.error(request, "Please fix the errors below to complete registration.")
    else:
        form = UserRegisterForm()

    return render(
        request,
        "accounts/register.html",
        {
            "form": form,
            "google_auth_enabled": settings.GOOGLE_AUTH_ENABLED,
            "breadcrumbs": [{"label": "Home", "url": "/"}, {"label": "Register"}],
        },
    )


class UserLoginView(LoginView):
    template_name = "accounts/login.html"
    authentication_form = UserLoginForm

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["google_auth_enabled"] = settings.GOOGLE_AUTH_ENABLED
        context["breadcrumbs"] = [{"label": "Home", "url": "/"}, {"label": "Login"}]
        return context

    def dispatch(self, request, *args, **kwargs):
        if request.method.lower() == "post" and is_login_locked_out(request):
            messages.error(request, "Too many failed login attempts. Please try again later.")
            return self.form_invalid(self.get_form())
        return super().dispatch(request, *args, **kwargs)

    def form_invalid(self, form):
        if not is_login_locked_out(self.request):
            increment_login_failures(self.request)
        if is_login_locked_out(self.request):
            messages.error(
                self.request,
                f"Too many failed login attempts. Please wait {LOGIN_LOCKOUT_MINUTES} minutes.",
            )
        return super().form_invalid(form)

    def form_valid(self, form):
        request = self.request
        request.session.pop(OTP_VERIFIED_KEY, None)
        request.session.pop(OTP_SESSION_KEY, None)
        request.session.pop(OTP_EXPIRES_KEY, None)
        request.session.pop(OTP_ATTEMPTS_KEY, None)
        request.session.pop(OTP_NEXT_KEY, None)
        request.session.pop(LOGIN_FAILED_ATTEMPTS_KEY, None)
        request.session.pop(LOGIN_LOCKOUT_UNTIL_KEY, None)
        messages.success(request, "You have logged in successfully.")
        return super().form_valid(form)

    def get_success_url(self):
        user = self.request.user
        if user.can_access_admin_panel:
            return reverse("admin:index")
        return "/"


@login_required
def verify_otp_view(request):
    if request.session.get(OTP_VERIFIED_KEY):
        return redirect(request.session.get(OTP_NEXT_KEY, "/"))

    if request.method == "POST":
        form = OTPVerificationForm(request.POST)
        if form.is_valid():
            entered_code = form.cleaned_data["otp_code"].strip()
            stored_code = request.session.get(OTP_SESSION_KEY)
            expires_at = request.session.get(OTP_EXPIRES_KEY)
            attempts = request.session.get(OTP_ATTEMPTS_KEY, 0) + 1
            request.session[OTP_ATTEMPTS_KEY] = attempts

            if expires_at is None or timezone.now().timestamp() > expires_at:
                messages.error(request, "Your code has expired. A new code has been sent to your email.")
                send_seller_otp_code(request, request.user)
                return redirect("accounts:verify_otp")

            if attempts > MAX_OTP_ATTEMPTS:
                messages.error(request, "Too many attempts. A new code has been sent to your email.")
                send_seller_otp_code(request, request.user)
                return redirect("accounts:verify_otp")

            if entered_code == stored_code:
                request.session[OTP_VERIFIED_KEY] = True
                request.session.pop(OTP_SESSION_KEY, None)
                request.session.pop(OTP_EXPIRES_KEY, None)
                request.session.pop(OTP_ATTEMPTS_KEY, None)
                if not request.user.is_verified_seller:
                    request.user.is_verified_seller = True
                    request.user.save(update_fields=["is_verified_seller"])
                messages.success(request, "OTP verified. You can continue to seller actions.")
                return redirect(request.session.get(OTP_NEXT_KEY, "/"))

            messages.error(request, "Invalid verification code.")
    else:
        form = OTPVerificationForm()
        if not has_pending_seller_otp(request):
            send_seller_otp_code(request, request.user)

    return render(request, "accounts/verify_otp.html", {"form": form, "breadcrumbs": [{"label": "Home", "url": "/"}, {"label": "Verify OTP"}]})


@login_required
def resend_otp_view(request):
    if send_seller_otp_code(request, request.user):
        messages.success(request, "A new verification code has been sent to your email.")
    return redirect("accounts:verify_otp")


@login_required
def logout_view(request):
    logout(request)
    messages.success(request, "You have logged out successfully.")
    return redirect("core:home")


@login_required
def profile_view(request):
    if request.method == "POST":
        form = ProfileUpdateForm(request.POST, instance=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, "Your profile has been updated successfully.")
            return redirect("accounts:profile")
    else:
        form = ProfileUpdateForm(instance=request.user)

    return render(request, "accounts/profile.html", {"form": form, "breadcrumbs": [{"label": "Home", "url": "/"}, {"label": "Profile"}]})
