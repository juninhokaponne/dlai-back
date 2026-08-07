import type { NextFunction, Response } from "express";
import { parse } from "csv-parse/sync";
import { desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../../database/index.js";
import { contacts } from "../../database/schema/schema.js";
import type { AuthenticatedRequest } from "../../shared/middlewares/auth.js";
import { contactRowSchema } from "./contact.schema.js";

const MAX_ROWS = 20_000;
const MAX_INVALID_SAMPLES = 20;

export class ContactsController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const offset = Math.max(Number(req.query.offset) || 0, 0);

      const rows = await db
        .select()
        .from(contacts)
        .where(eq(contacts.userId, req.user!.userId))
        .orderBy(desc(contacts.createdAt))
        .limit(limit)
        .offset(offset);

      return res.json({ contacts: rows });
    } catch (err) {
      next(err);
    }
  }

  async import(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "CSV file is required (field 'file')." });
      }

      let records: Record<string, string>[];
      try {
        records = parse(file.buffer, {
          columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
          trim: true,
          skip_empty_lines: true,
        });
      } catch {
        return res.status(400).json({ error: "Could not parse CSV file." });
      }

      if (records.length === 0) {
        return res.status(400).json({ error: "CSV file has no rows." });
      }
      if (records.length > MAX_ROWS) {
        return res
          .status(400)
          .json({ error: `CSV has too many rows (max ${MAX_ROWS}).` });
      }

      const seen = new Set<string>();
      const validRows: z.infer<typeof contactRowSchema>[] = [];
      const invalidSamples: { row: number; error: string }[] = [];
      let invalidCount = 0;

      records.forEach((record, index) => {
        const parsed = contactRowSchema.safeParse(record);
        if (!parsed.success) {
          invalidCount++;
          if (invalidSamples.length < MAX_INVALID_SAMPLES) {
            invalidSamples.push({
              row: index + 2,
              error: parsed.error.issues[0]?.message ?? "Invalid row.",
            });
          }
          return;
        }

        if (seen.has(parsed.data.email)) return;
        seen.add(parsed.data.email);
        validRows.push(parsed.data);
      });

      if (validRows.length === 0) {
        return res.status(400).json({
          error: "No valid contacts found in CSV.",
          invalidCount,
          invalidSamples,
        });
      }

      const inserted = await db
        .insert(contacts)
        .values(
          validRows.map((row) => ({
            email: row.email,
            userId: req.user!.userId,
            ...(row.name !== undefined ? { name: row.name } : {}),
          })),
        )
        .onConflictDoNothing({
          target: [contacts.userId, contacts.email],
        })
        .returning({ id: contacts.id });

      return res.status(201).json({
        imported: inserted.length,
        skippedDuplicates: validRows.length - inserted.length,
        invalidCount,
        invalidSamples,
      });
    } catch (err) {
      next(err);
    }
  }
}
