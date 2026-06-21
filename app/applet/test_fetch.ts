async function test() {
  try {
    const baseUrl = process.env.ASO_ANALYZER_URL || `http://localhost:${process.env.PORT || '3000'}`;
    const res = await fetch(`${baseUrl}/api/keywords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Spotify - Music and Podcasts', description: 'Listen to your favorite songs and podcasts.' })
    });
    
    if (!res.ok) {
       console.log('HTTP Error:', res.status, await res.text());
       return;
    }
    
    const data = await res.json();
    console.log('KEYWORDS:', data.keywords.length);
  } catch (e) {
    console.error('Fetch error:', e);
  }
}
test();
