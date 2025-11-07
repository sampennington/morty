import { MortyAPI } from './api';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('🚀 Morty Express Challenge - Request API Token\n');

  const name = await question('Enter your name: ');
  const email = await question('Enter your email: ');

  try {
    await MortyAPI.requestToken(name, email);
    console.log('\n✅ Token request sent! Check your email for the API token.');
    console.log('📝 Once you receive it, add it to your .env file as API_TOKEN=your_token_here');
  } catch (error) {
    console.error('❌ Error requesting token:', error);
  } finally {
    rl.close();
  }
}

main();
