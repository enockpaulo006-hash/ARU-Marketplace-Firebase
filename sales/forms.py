from django import forms


class CompleteSaleForm(forms.Form):
    sale_amount = forms.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=0,
        widget=forms.NumberInput(attrs={"placeholder": "Enter final sale amount"})
    )
