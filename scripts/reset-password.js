#!/usr/bin/env node
/**
 * Reset the admin credentials from the terminal.
 *
 *   npm run reset-password
 *   npm run reset-password -- --user read --pass "MyNewPassw0rd"
 *
 * Nothing is ever written into an HTML file: only the scrypt hash in SQLite.
 */
const readline = require('readline');
const store = require('../src/db');
const auth = require('../src/crypto');

store.bootstrap();

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 ? args[i + 1] : null;
};

async function ask(question, { hidden = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  if (hidden) {
    rl._writeToOutput = function (s) {
      if (s.includes(question)) rl.output.write(s);
      else rl.output.write('*');
    };
  }
  const answer = await new Promise((resolve) => rl.question(question, resolve));
  rl.close();
  if (hidden) process.stdout.write('\n');
  return answer.trim();
}

(async () => {
  const users = store.db.prepare('SELECT id, username FROM users ORDER BY id LIMIT 1').get();
  if (!users) {
    console.error('No admin user found. Start the server once with `npm start` first.');
    process.exit(1);
  }

  let username = flag('user');
  let password = flag('pass');

  if (!username) username = (await ask(`New username [${users.username}]: `)) || users.username;
  if (!password) password = await ask('New password (blank = generate random): ', { hidden: true });
  if (!password) password = auth.randomPassword();
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  store.updateUsername(users.id, username);
  store.updatePassword(users.id, password);

  console.log('\n' + '─'.repeat(56));
  console.log('  ADMIN CREDENTIALS UPDATED');
  console.log('  username : ' + username);
  console.log('  password : ' + password);
  console.log('─'.repeat(56) + '\n');
  process.exit(0);
})();
