import { Router } from "express";
import multer from "multer";
import { ContactsController } from "./contacts.controller.js";
import { requireAuth } from "../../shared/middlewares/auth.js";
import { validate } from "../../shared/middlewares/validate.js";
import { contactRowSchema, importTextSchema } from "./contact.schema.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = Router();
const controller = new ContactsController();

router.get("/unsubscribe/:token", controller.unsubscribe);

router.use(requireAuth);

router.get("/", controller.list);
router.post("/", validate(contactRowSchema), controller.create);
router.post("/import", upload.single("file"), controller.import);
router.post("/import-text", validate(importTextSchema), controller.importText);
router.post("/:id/tags", controller.addTag);
router.delete("/:id/tags/:tagId", controller.removeTag);

export { router as contactsRoutes };
