import { WordNet } from 'natural';
import 'dotenv/config';

async function test() {
  const wordnet = new WordNet();
  console.log('Testing WordNet lookup for "list"...');
  return new Promise((resolve) => {
    wordnet.lookup('list', (results) => {
      console.log('Results:', results ? results.length : 0);
      if (results) {
        console.log('Sample synonyms:', results[0].synonyms);
      }
      resolve(true);
    });
  });
}

test()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
