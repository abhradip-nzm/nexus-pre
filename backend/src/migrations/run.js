require('dotenv').config();
const { runMigrations } = require('./schema');

runMigrations()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration error:', err);
    process.exit(1);
  });
