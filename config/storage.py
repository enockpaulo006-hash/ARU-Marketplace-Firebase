from pathlib import PurePosixPath

import cloudinary.uploader
import cloudinary.utils
from django.core.files.storage import Storage


class CloudinaryMediaStorage(Storage):
    """Store uploaded media files in Cloudinary."""

    def _save(self, name, content):
        if hasattr(content, "seek"):
            content.seek(0)

        path = PurePosixPath(str(name).replace("\\", "/"))
        folder = str(path.parent) if str(path.parent) != "." else None
        public_id = path.stem or "upload"

        result = cloudinary.uploader.upload(
            content,
            folder=folder,
            public_id=public_id,
            resource_type="image",
            overwrite=False,
            unique_filename=True,
            use_filename=True,
        )
        return result["public_id"]

    def exists(self, name):
        return False

    def url(self, name):
        url, _options = cloudinary.utils.cloudinary_url(
            name,
            resource_type="image",
            secure=True,
        )
        return url

    def delete(self, name):
        if name:
            cloudinary.uploader.destroy(
                name,
                resource_type="image",
                invalidate=True,
            )
