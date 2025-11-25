import app from "./app.js";
import { loadEnv } from "./config/env.js";

loadEnv();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Lurk backend running on port ${PORT}`);
});
