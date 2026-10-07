from django import forms

from .models import Order


def validate_order_phone_number(value: str) -> str:
    phone_number = value.strip()

    if not phone_number.isdigit():
        raise forms.ValidationError("Phone number must contain digits only.")

    if len(phone_number) != 10:
        raise forms.ValidationError("Phone number must be exactly 10 digits.")

    if not phone_number.startswith("0"):
        raise forms.ValidationError("Phone number must start with 0.")

    return phone_number


class OrderRequestForm(forms.ModelForm):
    buyer_phone = forms.CharField(
        max_length=10,
        min_length=10,
        widget=forms.TextInput(attrs={"placeholder": "Enter your phone number"}),
    )

    class Meta:
        model = Order
        fields = ["buyer_phone", "order_message"]
        widgets = {
            "order_message": forms.Textarea(attrs={"placeholder": "Write what you want to order", "rows": 5}),
        }

    def clean_buyer_phone(self):
        return validate_order_phone_number(self.cleaned_data["buyer_phone"])
