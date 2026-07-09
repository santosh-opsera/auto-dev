// MongoDB initialization script — seeds test data structure on first container start
const database = process.env.MONGO_DATABASE || 'autodev';

db = db.getSiblingDB(database);

db.users.insertMany([
  {
    _id: 'user-001',
    email: 'alex.dev@example.com',
    displayName: 'Alex Developer',
    role: 'user',
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
  },
  {
    _id: 'user-002',
    email: 'dana.lead@example.com',
    displayName: 'Dana Team Lead',
    role: 'admin',
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
  },
]);

db.createCollection('convention_settings');
db.createCollection('audit_events');

print(`Seeded ${database} database with fixture data`);
