// Скрипт для генерации bcrypt hash пароля
// Использование: node k6-generate-password-hash.js

const bcrypt = require('bcrypt');

async function generateHash() {
  const password = 'TestPassword123!';
  const hash = await bcrypt.hash(password, 10);
  console.log('Password:', password);
  console.log('Bcrypt Hash:', hash);
  console.log('');
  console.log('Используйте этот hash в SQL скрипте:');
  console.log(`'${hash}'`);
}

generateHash().catch(console.error);

