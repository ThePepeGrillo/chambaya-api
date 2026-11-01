import { createServer } from "node:http";
import { registerRoutes } from "./handlers";
import { handleRequest } from "./http";

const PORT = Number(process.env.PORT) || 3000;

registerRoutes();

createServer((req, res) => {
  void handleRequest(req, res);
}).listen(PORT, () => {
  console.log(`ChambaYa API escuchando en http://localhost:${PORT}/api/v1`);
});
