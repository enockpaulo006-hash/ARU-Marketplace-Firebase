from io import BytesIO
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from PIL import Image, ImageOps

from products.models import Product


class Command(BaseCommand):
    help = "Resize and compress existing product images."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be optimized without saving files.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        optimized = 0
        skipped = 0

        for product in Product.objects.exclude(image="").iterator():
            try:
                product.image.open("rb")
                original_size = product.image.size
                image = Image.open(product.image)
                image = ImageOps.exif_transpose(image)
            except Exception as exc:
                skipped += 1
                self.stderr.write(f"Skipped product {product.pk}: {exc}")
                continue

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
            new_size = output.getbuffer().nbytes

            if new_size >= original_size:
                skipped += 1
                continue

            optimized += 1
            if dry_run:
                self.stdout.write(
                    f"Would optimize product {product.pk}: {original_size} -> {new_size} bytes"
                )
                continue

            image_name = f"{Path(product.image.name).stem[:80] or product.pk}.jpg"
            product.image.save(image_name, ContentFile(output.read()), save=True)
            self.stdout.write(
                f"Optimized product {product.pk}: {original_size} -> {new_size} bytes"
            )

        summary = f"Optimized {optimized} image(s); skipped {skipped} image(s)."
        self.stdout.write(self.style.SUCCESS(summary))
