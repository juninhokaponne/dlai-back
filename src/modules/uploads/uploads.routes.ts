import { Router } from "express";
import multer from "multer";
import { UploadsController } from "./uploads.controller.js";
import { requireAuth } from "../../shared/middlewares/auth.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!allowed.includes(file.mimetype)) {
      return callback(new Error("Only PNG, JPEG, WEBP or GIF images are allowed."));
    }
    callback(null, true);
  },
});

const router = Router();
const controller = new UploadsController();

router.use(requireAuth);

router.post("/image", upload.single("image"), controller.uploadImage);

export { router as uploadsRoutes };
