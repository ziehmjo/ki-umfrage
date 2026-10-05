// Frontend der KI-Umfrage: baut das Formular aus FRAGEN, schickt die Antworten
// an das Google Apps Script und zeigt danach die Live-Ergebnisse.

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzl_NNhRmwDIThiOnnWDahIal7Xp1MLPcV1pYt9UJbttFjrewDvsWBodv86wxzEXq0/exec';

// Alle Fragen als Daten. Die Antwortoptionen müssen exakt zu ERLAUBT in backend/Code.gs passen.
// "wenn" steuert die Verzweigung: Die Frage erscheint nur, wenn die Bedingung zutrifft.
const FRAGEN = [
  {
    id: 'studiengang',
    text: 'Was studierst du?',
    typ: 'einfach',
    optionen: ['Wirtschaftsingenieurwesen', 'Maschinenbau', 'Informatik', 'BWL', 'Elektrotechnik', 'Sonstiges']
  },
  {
    id: 'semester',
    text: 'In welchem Semester bist du?',
    typ: 'einfach',
    zahl: true,
    raster: true,
    optionen: ['1', '2', '3', '4', '5', '6', '7']
  },
  {
    id: 'haeufigkeit',
    text: 'Wie oft nutzt du KI fürs Studium?',
    typ: 'einfach',
    optionen: ['nie', 'seltener als wöchentlich', 'wöchentlich', 'mehrmals pro Woche', 'täglich']
  },
  {
    id: 'tools',
    text: 'Welche KI-Tools nutzt du?',
    hinweis: 'Mehrere Antworten möglich',
    typ: 'mehrfach',
    optionen: ['ChatGPT', 'Claude', 'Gemini', 'Copilot', 'DeepL', 'Sonstige'],
    wenn: a => a.haeufigkeit !== 'nie'
  },
  {
    id: 'zweck',
    text: 'Wofür nutzt du KI?',
    hinweis: 'Mehrere Antworten möglich',
    typ: 'mehrfach',
    optionen: ['Erklären lassen', 'Programmieren', 'Texte schreiben', 'Lernen und Abfragen', 'Recherche', 'Übersetzen'],
    wenn: a => a.haeufigkeit !== 'nie'
  },
  {
    id: 'gruende',
    text: 'Warum nutzt du keine KI?',
    hinweis: 'Mehrere Antworten möglich',
    typ: 'mehrfach',
    optionen: ['Kein Bedarf', 'Vertraue den Antworten nicht', 'Unsicher ob erlaubt', 'Datenschutz', 'Weiß nicht wie'],
    wenn: a => a.haeufigkeit === 'nie'
  },
  {
    id: 'vertrauen',
    text: 'Wie sehr vertraust du den Antworten von KI?',
    typ: 'skala',
    zahl: true,
    optionen: ['1', '2', '3', '4', '5'],
    pole: ['gar nicht', 'voll und ganz']
  },
  {
    id: 'meinung',
    text: 'Sollte die Hochschule KI im Studium erlauben?',
    typ: 'einfach',
    optionen: ['Ja ohne Einschränkung', 'Ja mit klaren Regeln', 'Nein']
  }
];

// Was nach dem Absenden ausgewertet wird, in dieser Reihenfolge.
const AUSWERTUNG = [
  { id: 'haeufigkeit', titel: 'So oft wird KI genutzt' },
  { id: 'tools', titel: 'Beliebteste Tools' },
  { id: 'zweck', titel: 'Wofür KI genutzt wird' },
  { id: 'gruende', titel: 'Warum manche keine KI nutzen' },
  { id: 'meinung', titel: 'Soll die Hochschule KI erlauben?' }
];

const antworten = {};
let schritt = 0;

const app = document.getElementById('app');
const form = document.getElementById('umfrage');
const fortschritt = document.getElementById('fortschritt');
const fortschrittBalken = document.getElementById('fortschritt-balken');

// Nur die Fragen, die zu den bisherigen Antworten passen. Hier passiert die Verzweigung.
function sichtbareFragen() {
  return FRAGEN.filter(f => !f.wenn || f.wenn(antworten));
}

function istBeantwortet(frage) {
  const wert = antworten[frage.id];
  return Array.isArray(wert) ? wert.length > 0 : wert !== undefined;
}

function setzeFortschritt(anteil) {
  fortschritt.hidden = anteil === null;
  fortschrittBalken.style.width = Math.round((anteil || 0) * 100) + '%';
}

function esc(text) {
  return String(text).replace(/[&<>"']/g, z => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));
}

// ---------- Bildschirme ----------

function zeigeStart() {
  setzeFortschritt(null);
  app.innerHTML = `
    <p class="text">Ein paar kurze Fragen dazu, wie du KI im Studium einsetzt.
      Die Umfrage ist anonym. Am Ende siehst du, wie die anderen geantwortet haben.</p>
    <div class="aktionen">
      <button type="button" class="knopf haupt" id="start">Los geht's</button>
    </div>`;
  document.getElementById('start').onclick = () => { schritt = 0; zeigeFrage(); };
}

function zeigeFrage() {
  const fragen = sichtbareFragen();
  const frage = fragen[schritt];
  const letzte = schritt === fragen.length - 1;
  setzeFortschritt(schritt / fragen.length);

  const inputTyp = frage.typ === 'mehrfach' ? 'checkbox' : 'radio';
  const gewaehlt = [].concat(antworten[frage.id] ?? []).map(String);

  const optionen = frage.optionen.map(o => `
    <label class="option">
      <input type="${inputTyp}" name="${frage.id}" value="${esc(o)}" ${gewaehlt.includes(o) ? 'checked' : ''}>
      <span>${esc(o)}</span>
    </label>`).join('');

  const pole = frage.pole
    ? `<div class="pole"><span>${esc(frage.pole[0])}</span><span>${esc(frage.pole[1])}</span></div>`
    : '';

  app.innerHTML = `
    <fieldset class="frage">
      <legend>
        <span class="nummer">Frage ${schritt + 1} von ${fragen.length}</span>
        ${esc(frage.text)}
      </legend>
      ${frage.hinweis ? `<p class="hinweis">${esc(frage.hinweis)}</p>` : ''}
      <div class="optionen ${frage.typ} ${frage.raster ? 'raster' : ''}">${optionen}</div>
      ${pole}
    </fieldset>
    <div class="aktionen">
      ${schritt > 0 ? '<button type="button" class="knopf" id="zurueck">Zurück</button>' : '<span></span>'}
      <button type="submit" class="knopf haupt" id="weiter">${letzte ? 'Absenden' : 'Weiter'}</button>
    </div>`;

  const weiter = document.getElementById('weiter');
  weiter.disabled = !istBeantwortet(frage);

  // Jede Auswahl sofort in "antworten" merken.
  app.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', () => {
      const markiert = [...app.querySelectorAll(`input[name="${frage.id}"]:checked`)].map(i => i.value);
      const werte = frage.zahl ? markiert.map(Number) : markiert;
      antworten[frage.id] = frage.typ === 'mehrfach' ? werte : werte[0];
      weiter.disabled = !istBeantwortet(frage);
    });
  });

  const zurueck = document.getElementById('zurueck');
  if (zurueck) zurueck.onclick = () => { schritt--; zeigeFrage(); };
}

// Weiter-Knopf oder Enter-Taste.
form.addEventListener('submit', event => {
  event.preventDefault();
  const fragen = sichtbareFragen();
  if (!fragen[schritt] || !istBeantwortet(fragen[schritt])) return;
  if (schritt < fragen.length - 1) {
    schritt++;
    zeigeFrage();
  } else {
    absenden();
  }
});

function zeigeStatus(text) {
  app.innerHTML = `<p class="status"><span class="spinner"></span>${esc(text)}</p>`;
}

function zeigeFehler(meldung) {
  app.innerHTML = `
    <p class="fehler">Das Absenden hat nicht geklappt: ${esc(meldung)}</p>
    <div class="aktionen">
      <button type="button" class="knopf" id="zurueck">Zurück</button>
      <button type="button" class="knopf haupt" id="nochmal">Nochmal versuchen</button>
    </div>`;
  document.getElementById('zurueck').onclick = () => zeigeFrage();
  document.getElementById('nochmal').onclick = () => absenden();
}

// ---------- Verbindung zum Apps Script ----------

async function absenden() {
  setzeFortschritt(1);
  zeigeStatus('Wird gesendet …');

  // Nur Antworten auf sichtbare Fragen schicken. Wer z. B. erst "täglich" und
  // dann doch "nie" gewählt hat, schickt keine alten Tool-Antworten mit.
  const daten = { website: document.getElementById('website').value };
  sichtbareFragen().forEach(f => { daten[f.id] = antworten[f.id]; });

  try {
    // text/plain statt application/json: so fragt der Browser nicht vorher per
    // CORS-Preflight nach, das Apps Script nicht beantworten kann.
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(daten)
    });
    const ergebnis = await res.json();
    if (!ergebnis.ok) throw new Error(ergebnis.fehler || 'Unbekannter Fehler');
  } catch (err) {
    zeigeFehler(err.message);
    return;
  }

  zeigeErgebnisse();
}

async function zeigeErgebnisse() {
  setzeFortschritt(null);
  zeigeStatus('Ergebnisse werden geladen …');

  let daten;
  try {
    const res = await fetch(SCRIPT_URL);
    daten = await res.json();
  } catch (err) {
    app.innerHTML = '<p class="text">Danke, deine Antwort ist gespeichert. Die Ergebnisse konnten gerade nicht geladen werden.</p>';
    return;
  }

  const abschnitte = AUSWERTUNG
    .filter(a => Object.keys(daten[a.id] || {}).length > 0)
    .map(a => balkenDiagramm(a, daten[a.id]))
    .join('');

  app.innerHTML = `
    <p class="danke">Danke! Deine Antwort ist gespeichert.</p>
    <p class="text">Bisher ${daten.anzahl === 1 ? 'hat' : 'haben'} <strong>${daten.anzahl}</strong> ${daten.anzahl === 1 ? 'Person' : 'Personen'} teilgenommen.
      Deine Antworten sind markiert.</p>
    ${vertrauensWert(daten.vertrauen)}
    ${abschnitte}`;
}

// Balken pro Antwortoption, in der Reihenfolge aus FRAGEN.
function balkenDiagramm(auswertung, zaehlung) {
  const frage = FRAGEN.find(f => f.id === auswertung.id);
  const max = Math.max(...Object.values(zaehlung));
  const meine = [].concat(antworten[frage.id] ?? []).map(String);

  const zeilen = frage.optionen.map(o => {
    const n = zaehlung[o] || 0;
    const mein = meine.includes(o);
    return `
      <div class="zeile ${mein ? 'mein' : ''}">
        <span class="label">${esc(o)}${mein ? ' <em>(du)</em>' : ''}</span>
        <span class="spur"><span class="balken" style="width:${max ? (n / max) * 100 : 0}%"></span></span>
        <span class="wert">${n}</span>
      </div>`;
  }).join('');

  return `<section class="auswertung"><h2>${esc(auswertung.titel)}</h2>${zeilen}</section>`;
}

function vertrauensWert(zaehlung) {
  let summe = 0;
  let anzahl = 0;
  Object.entries(zaehlung || {}).forEach(([stufe, n]) => { summe += Number(stufe) * n; anzahl += n; });
  if (!anzahl) return '';
  const schnitt = (summe / anzahl).toFixed(1).replace('.', ',');
  return `
    <section class="auswertung kennzahl">
      <h2>Vertrauen in KI-Antworten</h2>
      <p><span class="gross">${schnitt}</span> von 5 im Schnitt, deine Angabe: ${antworten.vertrauen}</p>
    </section>`;
}

zeigeStart();
