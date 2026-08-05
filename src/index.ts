import express from "express";
import { db } from "./database/index.js";
import { users } from "./database/schema/schema.js";

const app = express();
const port = 3000;

app.use(express.json());

app.get("/health", async (req, res) => {
  const ip = req.ip;

  try {
    const createUser = await db.insert(users).values({
      name: "Gilson",
      lastName: "Oliveira",
      age: 25,
      email: "gilson@email.com",
      passwordHash: "hash",
    });

    if (createUser.rowCount == 0) {
      throw new Error("Error creating user!");
    }

    const user = await db.select().from(users);

    console.log(user);

    res.json({
      ip,
      message: user,
    });
  } catch (err) {
    console.error(err);
  }
});

app.listen(port, () => {
  console.log(`App running at port ${port}`);
});
