const OPENROUTER_KEY = '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';
const model = 'meta-llama/llama-3.3-70b-instruct:free';
const prompt = 'Hello, this is a test prompt to check if OpenRouter is responding.';

async function testCall() {
  console.log('Sending test request to OpenRouter...');
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.7
      })
    });

    console.log('Response status:', res.status);
    const text = await res.text();
    console.log('Response body:', text);
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

testCall();
