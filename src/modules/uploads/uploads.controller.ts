import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../../shared/middlewares/auth.js";
import { SpacesStorageProvider } from "../../shared/storage/spaces.provider.js";

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export class UploadsController {
  async uploadImage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "Image file is required (field 'image')." });
      }

      const extension = IMAGE_EXTENSION_BY_MIME[file.mimetype];
      if (!extension) {
        return res.status(400).json({ error: "Only PNG, JPEG, WEBP or GIF images are allowed." });
      }

      const storage = new SpacesStorageProvider();
      const url = await storage.uploadFile(
        "content-images",
        req.user!.userId,
        file.buffer,
        file.mimetype,
        extension,
      );

      return res.status(201).json({ url });
    } catch (err) {
      next(err);
    }
  }
}
