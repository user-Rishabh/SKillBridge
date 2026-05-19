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
        messages: [{ role: 'user', content: 'Hello! Please tell me a very short 1-sentence programming joke.' }],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    console.log(`Model: ${model} -> Response status: ${res.status}`);
    const data = await res.json();
    console.log('Response content:', data.choices?.[0]?.message?.content || JSON.stringify(data));
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

async function run() {
  await testCall('openrouter/free');
  console.log('\n-------------------\n');
  await testCall('minimax/minimax-m2.5:free');
}

run();
