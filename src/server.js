import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { CsvRpgRepository } from "./repositories/csv/CsvRpgRepository.js";
import { PostgresRpgRepository } from "./repositories/postgres/PostgresRpgRepository.js";
import { AuthService } from "./services/authService.js";
import { RpgService } from "./services/rpgService.js";

const repository = config.storageDriver === "postgres"
  ? new PostgresRpgRepository(config.databaseUrl)
  : new CsvRpgRepository(config.csvDatabasePath, config.legacyExcelDatabasePath);
await repository.initialize();

const authService = new AuthService({
  userRepository: repository.users,
  jwtSecret: config.jwtSecret,
});

const rpgService = new RpgService({ repository });
const app = createApp({
  authService,
  rpgService,
  jwtSecret: config.jwtSecret,
  corsOrigin: config.corsOrigin,
});
app.listen(config.port, () => {
  console.log(`API disponível em http://localhost:${config.port}`);
});
