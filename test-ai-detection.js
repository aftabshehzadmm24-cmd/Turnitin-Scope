// Quick test script to see detailed AI detection logs
const testText = `Artificial Intelligence: Transforming the Modern World

Introduction

Artificial Intelligence (AI) has emerged as one of the most transformative technologies of the 21st century. From virtual assistants to autonomous vehicles, AI is reshaping industries and redefining how humans interact with technology. This essay explores the fundamentals of AI, its applications, ethical considerations, and future implications.

What is Artificial Intelligence?

Artificial Intelligence refers to the simulation of human intelligence in machines programmed to think and learn like humans. AI systems can perform tasks that typically require human intelligence, such as visual perception, speech recognition, decision-making, and language translation.`;

fetch('http://localhost:3000/api/ai-detect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: testText })
})
  .then(r => r.json())
  .then(data => {
    console.log('\n📊 API RESPONSE:');
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(err => console.error('❌ Error:', err.message));
