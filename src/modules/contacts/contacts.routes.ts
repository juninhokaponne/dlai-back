import { Router } from "express";
import multer from "multer";
import { ContactsController } from "./contacts.controller.js";
import { requireAuth } from "../../shared/middlewares/auth.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = Router();
const controller = new ContactsController();

router.get("/unsubscribe/:token", controller.unsubscribe);

router.use(requireAuth);

router.get("/", controller.list);
router.post("/import", upload.single("file"), controller.import);

export { router as contactsRoutes };
