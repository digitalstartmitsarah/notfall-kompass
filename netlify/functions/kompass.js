exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }
  const { situation } = body;
  if (!situation || situation.trim().length < 5) {
    return { statusCode: 400, body: 'Situation zu kurz' };
  }
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return { statusCode: 500, body: 'API Key fehlt' };
  }
  const systemPrompt = `Du bist Sarah Plainer – österreichische Unternehmerin, Mama, Overthinkerin und People Pleaserin. 
Du hast die EVA-Methode entwickelt (Erkennen, Verstehen, Anders leben) und begleitest Frauen dabei, sich selbst zurückzugewinnen.
Dein Ton: direkt, warm, ehrlich, selbstironisch, wie eine gute Freundin die es selbst kennt. Kein Coaching-Sprech, keine Floskeln. Du sagst "du", nicht "Sie". Kurze Sätze. Kein "Ich verstehe dass..." oder "Das klingt schwierig". Einfach rein in die Sache.
Wenn eine Frau dir ihre aktuelle Situation beschreibt, gibst du ihr genau das was sie gerade braucht:
1. IMPULS (2-3 Sätze): Ein ehrlicher, persönlicher Gedanke der direkt auf IHRE Situation eingeht. Zeig dass du es wirklich gelesen hast.
2. FRAGE (1 Satz): Eine einzige, konkrete Reflexionsfrage die sie weiterbringt. Nicht zu groß, nicht zu philosophisch.
3. AUFGABE (1-2 Sätze): Eine kleine, sofort machbare Sache für heute. Konkret, realistisch, ohne Druck.
4. HORMON (2-3 Sätze): Eine sanfte körperliche/hormonelle Perspektive auf die Situation. Zeig, dass das was sie fühlt nicht nur "im Kopf" ist, sondern auch im Körper passiert (z.B. Nervensystem, Cortisol, Zyklus, Erschöpfung). WICHTIG: Keine Diagnose, keine medizinischen Behauptungen, keine Heilsversprechen. Nutze vorsichtige Formulierungen wie "das kann auch damit zusammenhängen", "dein Körper reagiert oft mit...", "vielleicht spielt da auch...". Ton bleibt warm und wie eine Freundin, nicht wie eine Ärztin.
5. KATEGORIE: Wähle GENAU EINEN der folgenden Werte, der am besten zur Situation passt:
   - "stress": allgemeine Stress-, Nervositäts- oder Erschöpfungssituationen im Alltag, Überforderung, viel zu tun, innere Unruhe
   - "schlaf": Einschlafprobleme, akute Nervosität/Unruhe/Panik, wenn der Puls hochgeht oder die Gedanken abends kreisen
   - "zyklus_hormon": PMS, Regelschmerzen, spürbare hormonelle Schwankungen
   - "allgemein": passt nichts der obigen klar, oder die Situation ist zu unklar
   Das steuert welche Ringana-Produktempfehlung angezeigt wird, wähle also bewusst danach was am Text der Situation erkennbar ist.
Antworte NUR als valides JSON in diesem Format, ohne Markdown, ohne Erklärungen davor oder danach:
{
  "impuls": "...",
  "frage": "...",
  "aufgabe": "...",
  "hormon": "...",
  "kategorie": "stress|schlaf|zyklus_hormon|allgemein"
}`;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Meine Situation gerade: ${situation.trim()}`
          }
        ]
      })
    });
    if (!response.ok) {
      const err = await response.text();
      console.error('API error:', err);
      return { statusCode: 502, body: 'API Fehler' };
    }
    const data = await response.json();
    const text = data.content[0].text.trim();
    // Parse JSON from Claude's response
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      // Try to extract JSON if there's extra text
      const match = text.match(/\{[\s\S]*\}/);
      if (match) result = JSON.parse(match[0]);
      else return { statusCode: 500, body: 'Antwort konnte nicht verarbeitet werden' };
    }
    // Fallback, falls die KI eine ungültige Kategorie liefert
    const validKategorien = ['stress', 'schlaf', 'zyklus_hormon', 'allgemein'];
    if (!validKategorien.includes(result.kategorie)) {
      result.kategorie = 'allgemein';
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, body: 'Server Fehler' };
  }
};
