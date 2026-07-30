import { setupTestDatabase, teardownTestDatabase } from './helpers/database';

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});
