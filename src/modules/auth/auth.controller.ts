import type { Request, Response } from "express";
import { db } from "../../database/index.js";
import { users } from "../../database/schema/schema.js";
import { hashPassword } from "../../shared/utils/security.js";
import { eq } from "drizzle-orm";

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const { name, lastname, age, email, password, company } = req.body;
      const lastName = lastname;

      if (!email || !name || !password) {
        return res.status(400).json({
          error: "All fields are required.",
        });
      }

      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        res.status(409).json({
          error: "User already exists.",
        });
      }

      const passwordHash = await hashPassword(password);

      const [newUser] = await db
        .insert(users)
        .values({ name, lastName, age, company, email, passwordHash })
        .returning();

      console.log(newUser);

      return res.status(201).json({
        message: "User created successfuly!",
        user: {
          id: newUser?.id,
          name: newUser?.name,
          email: newUser?.email,
        },
      });
    } catch (err) {
      console.error(err);
    }
  }
}
