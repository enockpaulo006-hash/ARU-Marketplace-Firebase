from io import BytesIO
from pathlib import Path

from django import forms
from django.conf import settings
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.forms import formset_factory
from PIL import Image, ImageOps

from .models import Product


def optimize_product_image(upload):
    if not upload or not getattr(upload, "content_type", "").startswith("image/"):
        return upload

    try:
        upload.seek(0)
        image = Image.open(upload)
        image = ImageOps.exif_transpose(image)
    except Exception:
        return upload

    if image.mode in ("RGBA", "LA") or (
        image.mode == "P" and "transparency" in image.info
    ):
        background = Image.new("RGB", image.size, (255, 255, 255))
        alpha = image.convert("RGBA").getchannel("A")
        background.paste(image.convert("RGBA"), mask=alpha)
        image = background
    elif image.mode != "RGB":
        image = image.convert("RGB")

    image.thumbnail(
        (settings.PRODUCT_IMAGE_MAX_WIDTH, settings.PRODUCT_IMAGE_MAX_HEIGHT),
        Image.Resampling.LANCZOS,
    )

    output = BytesIO()
    image.save(
        output,
        format="JPEG",
        quality=settings.PRODUCT_IMAGE_QUALITY,
        optimize=True,
        progressive=True,
    )
    output.seek(0)

    name = f"{Path(upload.name).stem[:80] or 'product'}.jpg"
    return InMemoryUploadedFile(
        output,
        field_name="image",
        name=name,
        content_type="image/jpeg",
        size=output.getbuffer().nbytes,
        charset=None,
    )


class ProductForm(forms.ModelForm):
    def clean_image(self):
        return optimize_product_image(self.cleaned_data.get("image"))

    class Meta:
        model = Product
        fields = [
            "title",
            "category",
            "price",
            "description",
            "image",
            "product_condition",
            "location",
        ]


ProductFormSet = formset_factory(
    ProductForm,
    extra=1,
    min_num=1,
    validate_min=True,
)
