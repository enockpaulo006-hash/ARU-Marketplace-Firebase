from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.password_validation import validate_password
from allauth.socialaccount.forms import SignupForm as SocialSignupForm

User = get_user_model()


def validate_phone_number(value: str) -> str:
    phone_number = value.strip()

    if not phone_number.isdigit():
        raise forms.ValidationError("Phone number must contain digits only.")

    if len(phone_number) != 10:
        raise forms.ValidationError("Phone number must be exactly 10 digits.")

    if not phone_number.startswith("0"):
        raise forms.ValidationError("Phone number must start with 0.")

    return phone_number


class UserRegisterForm(forms.ModelForm):
    full_name = forms.CharField(max_length=150)
    phone_number = forms.CharField(max_length=10, min_length=10)
    password = forms.CharField(min_length=8, widget=forms.PasswordInput)
    confirm_password = forms.CharField(widget=forms.PasswordInput)

    class Meta:
        model = User
        fields = ["full_name", "email", "phone_number", "password"]

    def clean_email(self):
        email = self.cleaned_data["email"]
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError("An account with this email already exists.")
        return email

    def clean_phone_number(self):
        return validate_phone_number(self.cleaned_data["phone_number"])

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get("password")
        confirm_password = cleaned_data.get("confirm_password")

        if password and confirm_password and password != confirm_password:
            self.add_error("confirm_password", "Passwords do not match.")

        if password:
            validate_password(password, self.instance)

        return cleaned_data


class UserLoginForm(AuthenticationForm):
    username = forms.EmailField(label="Email")
    password = forms.CharField(widget=forms.PasswordInput)


class OTPVerificationForm(forms.Form):
    otp_code = forms.CharField(
        max_length=6,
        min_length=6,
        label="One-time code",
        widget=forms.TextInput(attrs={"autocomplete": "one-time-code"}),
    )


class ProfileUpdateForm(forms.ModelForm):
    phone_number = forms.CharField(max_length=10, min_length=10)

    class Meta:
        model = User
        fields = ["full_name", "email", "phone_number"]

    def clean_phone_number(self):
        return validate_phone_number(self.cleaned_data["phone_number"])


class SocialAccountCompletionForm(SocialSignupForm):
    full_name = forms.CharField(max_length=150, label="Full name")
    phone_number = forms.CharField(max_length=10, min_length=10, label="Phone number")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "email" in self.fields:
            self.fields["email"].disabled = True
            self.fields["email"].help_text = "Using the verified email from your Google account."
        account = getattr(self.sociallogin, "account", None)
        extra_data = getattr(account, "extra_data", {}) or {}
        full_name = extra_data.get("name") or " ".join(
            part for part in [extra_data.get("given_name"), extra_data.get("family_name")] if part
        )
        if not full_name:
            user = getattr(self.sociallogin, "user", None)
            full_name = " ".join(
                part for part in [getattr(user, "first_name", ""), getattr(user, "last_name", "")] if part
            )
        if full_name:
            self.fields["full_name"].initial = full_name

    def clean_phone_number(self):
        return validate_phone_number(self.cleaned_data["phone_number"])

    def save(self, request):
        user = self.sociallogin.user
        user.full_name = self.cleaned_data["full_name"]
        user.phone_number = self.cleaned_data["phone_number"]
        user.role = "user"
        return super().save(request)
