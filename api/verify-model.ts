import 'dotenv/config';
import Groq from 'groq-sdk';

async function verify() {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  try {
    const res = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 5
    });
    console.log('Success:', res.choices[0].message.content);
  } catch (e) {
    console.error('Failure:', e.message);
    process.exit(1);
  }
}
verify();
