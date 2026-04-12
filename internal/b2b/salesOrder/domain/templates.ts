import fs from "fs";
import path from "path";

export const salesOrderFactoryTemplate = fs.readFileSync(
  path.join(__dirname, "../html/salesOrderFactory.html"),
  "utf8",
);
