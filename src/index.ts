import express from "express";

const app = express();
const port = 3000;

app.use(express.json());

app.get("/health", (req, res) => {
  const ip = req.ip;
  const response = "Welcome to the app!";

  res.json({
    ip,
    message: response,
  });
});

app.listen(port, () => {
  console.log(`App running at port ${port}`);
});
