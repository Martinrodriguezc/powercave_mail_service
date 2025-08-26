import express from "express";
import mailRouter from "../controllers/controller";

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use("/mail", mailRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});