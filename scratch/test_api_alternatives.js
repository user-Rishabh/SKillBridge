const OPENROUTER_KEY = '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';

async function testCall(model) {
  console.log(`Sending request for model: ${model}...`);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Hello, respond with exactly 5 words.' }],
        max_tokens: 30,
        temperature: 0.7
      })
    });

    console.log(`Model: ${model} -> Response status: ${res.status}`);
    const text = await res.text();
    console.log('Response body:', text);
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

async function run() {
  await testCall('openrouter/free');
  console.log('\n-------------------\n');
  await testCall('deepseek/deepseek-v4-flash:free');
}

run();
