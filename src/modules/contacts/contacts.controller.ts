import type { NextFunction, Request, Response } from "express";
import { parse } from "csv-parse/sync";
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../database/index.js";
import { contacts, contactTags, tags } from "../../database/schema/schema.js";
import type { AuthenticatedRequest } from "../../shared/middlewares/auth.js";
import { contactRowSchema } from "./contact.schema.js";
import { fireNewSubscriberAutomations } from "../../shared/automations/contact-triggers.js";

const MAX_ROWS = 20_000;
const MAX_INVALID_SAMPLES = 20;
const MAX_MANUAL_CONTACTS = 50;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const idParamSchema = z.string().uuid();

function detectDelimiter(buffer: Buffer): string {
  const firstLine = buffer.toString("utf-8", 0, Math.min(buffer.length, 2000)).split(/\r?\n/)[0] ?? "";
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function parsePastedContactLine(line: string): Record<string, string> {
  const parts = line
    .split(/[,;\t]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return { email: parts[0] ?? "" };
  }

  const emailPart = parts.find((part) => EMAIL_REGEX.test(part));
  if (!emailPart) {
    return { email: parts[0] ?? "" };
  }

  const namePart = parts.find((part) => part !== emailPart);
  return { email: emailPart, ...(namePart ? { name: namePart } : {}) };
}

export class ContactsController {
  constructor() {
    // These three call private helper methods via `this.` internally, and
    // Express registers controller methods as bare function references
    // (`controller.create`, not `controller.create.bind(controller)`) — so
    // without this, `this` is `undefined` at call time and every request
    // through these three handlers throws.
    this.create = this.create.bind(this);
    this.import = this.import.bind(this);
    this.importText = this.importText.bind(this);
  }

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
      const tagIdFilter = idParamSchema.safeParse(req.query.tagId);

      const conditions = [eq(contacts.organizationId, req.user!.organizationId)];
      if (search) {
        conditions.push(or(ilike(contacts.email, `%${search}%`), ilike(contacts.name, `%${search}%`))!);
      }
      if (tagIdFilter.success) {
        conditions.push(
          inArray(
            contacts.id,
            db.select({ id: contactTags.contactId }).from(contactTags).where(eq(contactTags.tagId, tagIdFilter.data)),
          ),
        );
      }
      const whereClause = and(...conditions);

      const [rows, total] = await Promise.all([
        db
          .select()
          .from(contacts)
          .where(whereClause)
          .orderBy(desc(contacts.createdAt))
          .limit(limit)
          .offset(offset),
        db.$count(contacts, whereClause),
      ]);

      const contactTagRows =
        rows.length > 0
          ? await db
              .select({ contactId: contactTags.contactId, id: tags.id, name: tags.name })
              .from(contactTags)
              .innerJoin(tags, eq(contactTags.tagId, tags.id))
              .where(
                inArray(
                  contactTags.contactId,
                  rows.map((row) => row.id),
                ),
              )
          : [];

      const tagsByContactId = new Map<string, { id: string; name: string }[]>();
      for (const row of contactTagRows) {
        const existing = tagsByContactId.get(row.contactId) ?? [];
        existing.push({ id: row.id, name: row.name });
        tagsByContactId.set(row.contactId, existing);
      }

      const contactsWithTags = rows.map((row) => ({ ...row, tags: tagsByContactId.get(row.id) ?? [] }));

      return res.json({ contacts: contactsWithTags, total, limit, offset });
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { email, name, tagId } = req.body;

      const totalContacts = await db.$count(contacts, eq(contacts.organizationId, req.user!.organizationId));
      if (totalContacts >= MAX_MANUAL_CONTACTS) {
        return res.status(400).json({
          error: `Manual contact creation is limited to ${MAX_MANUAL_CONTACTS} contacts. Use CSV import for larger lists.`,
        });
      }

      const [existing] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.organizationId, req.user!.organizationId), eq(contacts.email, email)))
        .limit(1);

      if (existing) {
        return res.status(409).json({ error: "Contact already exists." });
      }

      const [contact] = await db
        .insert(contacts)
        .values({
          userId: req.user!.userId,
          organizationId: req.user!.organizationId,
          email,
          ...(name !== undefined ? { name } : {}),
        })
        .returning();

      if (tagId) {
        await this.applyTagIfOwned(req.user!.organizationId, [contact!.id], tagId);
      }

      void fireNewSubscriberAutomations(req.user!.organizationId, [contact!.id]);

      return res.status(201).json({ contact });
    } catch (err) {
      next(err);
    }
  }

  private async applyTagIfOwned(organizationId: string, contactIds: string[], tagId: string): Promise<void> {
    const [tag] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.id, tagId), eq(tags.organizationId, organizationId)))
      .limit(1);
    if (!tag || contactIds.length === 0) return;

    await db
      .insert(contactTags)
      .values(contactIds.map((contactId) => ({ contactId, tagId: tag.id })))
      .onConflictDoNothing();
  }

  private async resolveContactIdsForRows(
    organizationId: string,
    validRows: z.infer<typeof contactRowSchema>[],
  ): Promise<string[]> {
    if (validRows.length === 0) return [];
    const emails = validRows.map((row) => row.email);
    const rows = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.organizationId, organizationId), inArray(contacts.email, emails)));
    return rows.map((row) => row.id);
  }

  private extractValidRows(records: Record<string, string>[], rowNumberFor: (index: number) => number) {
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
            row: rowNumberFor(index),
            error: parsed.error.issues[0]?.message ?? "Invalid row.",
          });
        }
        return;
      }

      if (seen.has(parsed.data.email)) return;
      seen.add(parsed.data.email);
      validRows.push(parsed.data);
    });

    return { validRows, invalidCount, invalidSamples };
  }

  private async insertContacts(userId: string, organizationId: string, validRows: z.infer<typeof contactRowSchema>[]) {
    return db
      .insert(contacts)
      .values(
        validRows.map((row) => ({
          email: row.email,
          userId,
          organizationId,
          ...(row.name !== undefined ? { name: row.name } : {}),
        })),
      )
      .onConflictDoNothing({
        target: [contacts.organizationId, contacts.email],
      })
      .returning({ id: contacts.id });
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
          delimiter: detectDelimiter(file.buffer),
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

      const { validRows, invalidCount, invalidSamples } = this.extractValidRows(records, (index) => index + 2);

      if (validRows.length === 0) {
        return res.status(400).json({
          error: "No valid contacts found in CSV.",
          invalidCount,
          invalidSamples,
        });
      }

      const inserted = await this.insertContacts(req.user!.userId, req.user!.organizationId, validRows);

      const parsedTagId = idParamSchema.safeParse(req.body.tagId);
      if (parsedTagId.success) {
        const matchedIds = await this.resolveContactIdsForRows(req.user!.organizationId, validRows);
        await this.applyTagIfOwned(req.user!.organizationId, matchedIds, parsedTagId.data);
      }

      void fireNewSubscriberAutomations(
        req.user!.organizationId,
        inserted.map((row) => row.id),
      );

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

  async importText(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { text } = req.body as { text: string };

      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length === 0) {
        return res.status(400).json({ error: "Paste at least one contact." });
      }
      if (lines.length > MAX_ROWS) {
        return res.status(400).json({ error: `Too many contacts (max ${MAX_ROWS}).` });
      }

      const records = lines.map(parsePastedContactLine);
      const { validRows, invalidCount, invalidSamples } = this.extractValidRows(records, (index) => index + 1);

      if (validRows.length === 0) {
        return res.status(400).json({
          error: "No valid contacts found.",
          invalidCount,
          invalidSamples,
        });
      }

      const inserted = await this.insertContacts(req.user!.userId, req.user!.organizationId, validRows);

      const parsedTagId = idParamSchema.safeParse(req.body.tagId);
      if (parsedTagId.success) {
        const matchedIds = await this.resolveContactIdsForRows(req.user!.organizationId, validRows);
        await this.applyTagIfOwned(req.user!.organizationId, matchedIds, parsedTagId.data);
      }

      void fireNewSubscriberAutomations(
        req.user!.organizationId,
        inserted.map((row) => row.id),
      );

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

  async unsubscribe(req: Request, res: Response, next: NextFunction) {
    try {
      const parsedToken = z.string().uuid().safeParse(req.params.token);
      if (!parsedToken.success) {
        return res.status(400).send("<p>Link invalido.</p>");
      }

      const [contact] = await db
        .update(contacts)
        .set({ status: "unsubscribed" })
        .where(eq(contacts.unsubscribeToken, parsedToken.data))
        .returning({ id: contacts.id });

      if (!contact) {
        return res.status(404).send("<p>Contato nao encontrado.</p>");
      }

      return res
        .status(200)
        .send(
          "<p>Voce foi descadastrado com sucesso e nao vai mais receber emails desta lista.</p>",
        );
    } catch (err) {
      next(err);
    }
  }

  async addTag(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsedContactId = idParamSchema.safeParse(req.params.id);
      const parsedTagId = idParamSchema.safeParse(req.body.tagId);
      if (!parsedContactId.success || !parsedTagId.success) {
        return res.status(400).json({ error: "Invalid contact or tag id." });
      }

      const [contact] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.id, parsedContactId.data), eq(contacts.organizationId, req.user!.organizationId)))
        .limit(1);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found." });
      }

      const [tag] = await db
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.id, parsedTagId.data), eq(tags.organizationId, req.user!.organizationId)))
        .limit(1);
      if (!tag) {
        return res.status(404).json({ error: "Tag not found." });
      }

      await db
        .insert(contactTags)
        .values({ contactId: contact.id, tagId: tag.id })
        .onConflictDoNothing();

      return res.status(201).json({ message: "Tag applied." });
    } catch (err) {
      next(err);
    }
  }

  async removeTag(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsedContactId = idParamSchema.safeParse(req.params.id);
      const parsedTagId = idParamSchema.safeParse(req.params.tagId);
      if (!parsedContactId.success || !parsedTagId.success) {
        return res.status(400).json({ error: "Invalid contact or tag id." });
      }

      const [contact] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.id, parsedContactId.data), eq(contacts.organizationId, req.user!.organizationId)))
        .limit(1);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found." });
      }

      await db
        .delete(contactTags)
        .where(and(eq(contactTags.contactId, parsedContactId.data), eq(contactTags.tagId, parsedTagId.data)));

      return res.json({ message: "Tag removed." });
    } catch (err) {
      next(err);
    }
  }

  async bulkTag(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { contactIds, tagId } = req.body as { contactIds: string[]; tagId: string };

      const [tag] = await db
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.id, tagId), eq(tags.organizationId, req.user!.organizationId)))
        .limit(1);
      if (!tag) {
        return res.status(404).json({ error: "Tag not found." });
      }

      const ownedContacts = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            eq(contacts.organizationId, req.user!.organizationId),
            or(...contactIds.map((id) => eq(contacts.id, id))),
          ),
        );

      if (ownedContacts.length > 0) {
        await db
          .insert(contactTags)
          .values(ownedContacts.map((contact) => ({ contactId: contact.id, tagId: tag.id })))
          .onConflictDoNothing();
      }

      return res.json({ tagged: ownedContacts.length });
    } catch (err) {
      next(err);
    }
  }
}
