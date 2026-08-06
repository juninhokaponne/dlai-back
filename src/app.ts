import express from "express";
import helmet from "helmet";
import cors from "cors";
import { router } from "./routes";
import { errorHandler } from "./shared/middlewares/error-handler";
import { notFound } from "./shared/middlewares/not-found";

export const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") ?? [] }));
app.use(express.json({ limit: "1mb" }));

app.use("/api", router);

app.use(notFound);
app.use(errorHandler);
