// Backend der KI-Umfrage: nimmt Antworten an (doPost) und liefert die Auswertung (doGet).

const SHEET_NAME = 'Antworten';

// Nur diese Werte werden angenommen. Muss zu den Antwortoptionen im Frontend passen.
// Bei tools, zweck und gruende ist kein Wert Teil eines anderen, damit ZÄHLENWENN mit * sauber zählt.
const ERLAUBT = {
  studiengang: ['Wirtschaftsingenieurwesen', 'Maschinenbau', 'Informatik', 'BWL', 'Elektrotechnik', 'Sonstiges'],
  haeufigkeit: ['nie', 'seltener als wöchentlich', 'wöchentlich', 'mehrmals pro Woche', 'täglich'],
  tools: ['ChatGPT', 'Claude', 'Gemini', 'Copilot', 'DeepL', 'Sonstige'],
  zweck: ['Erklären lassen', 'Programmieren', 'Texte schreiben', 'Lernen und Abfragen', 'Recherche', 'Übersetzen'],
  gruende: ['Kein Bedarf', 'Vertraue den Antworten nicht', 'Unsicher ob erlaubt', 'Datenschutz', 'Weiß nicht wie'],
  meinung: ['Ja ohne Einschränkung', 'Ja mit klaren Regeln', 'Nein']
};

// Wird aufgerufen, wenn das Formular Daten schickt.
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);

    // Honeypot: Dieses Feld ist für Menschen unsichtbar. Ist es gefüllt, war es ein Bot.
    if (d.website) return antwort({ ok: true });

    const zeile = pruefen(d);

    // Sperre, damit zwei gleichzeitige Antworten sich nicht in die Quere kommen.
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      blatt().appendRow(zeile);
    } finally {
      lock.releaseLock();
    }
    return antwort({ ok: true });
  } catch (err) {
    return antwort({ ok: false, fehler: String(err.message || err) });
  }
}

// Wird aufgerufen, wenn jemand die URL normal öffnet. Liefert die Zählungen für die Live-Ergebnisse.
function doGet() {
  const zeilen = blatt().getDataRange().getValues().slice(1); // ohne Kopfzeile

  function zaehle(spalte, mehrfach) {
    const z = {};
    zeilen.forEach(function (r) {
      const werte = mehrfach ? String(r[spalte]).split(', ') : [String(r[spalte])];
      werte.filter(Boolean).forEach(function (w) { z[w] = (z[w] || 0) + 1; });
    });
    return z;
  }

  return antwort({
    anzahl: zeilen.length,
    haeufigkeit: zaehle(3, false),
    tools: zaehle(4, true),
    zweck: zaehle(5, true),
    gruende: zaehle(6, true),
    vertrauen: zaehle(7, false),
    meinung: zaehle(8, false)
  });
}

// Prüft alle Felder und baut daraus eine Zeile in der Reihenfolge der Spalten A bis I.
function pruefen(d) {
  const haeufigkeit = eins(d.haeufigkeit, ERLAUBT.haeufigkeit);
  const nutztKeine = haeufigkeit === 'nie';

  const semester = Number(d.semester);
  if (!Number.isInteger(semester) || semester < 1 || semester > 7) throw new Error('Semester ungültig');

  const vertrauen = Number(d.vertrauen);
  if (!Number.isInteger(vertrauen) || vertrauen < 1 || vertrauen > 5) throw new Error('Vertrauen ungültig');

  return [
    new Date(),
    eins(d.studiengang, ERLAUBT.studiengang),
    semester,
    haeufigkeit,
    nutztKeine ? '' : mehrere(d.tools, ERLAUBT.tools),
    nutztKeine ? '' : mehrere(d.zweck, ERLAUBT.zweck),
    nutztKeine ? mehrere(d.gruende, ERLAUBT.gruende) : '',
    vertrauen,
    eins(d.meinung, ERLAUBT.meinung)
  ];
}

function eins(wert, liste) {
  if (liste.indexOf(wert) === -1) throw new Error('Ungültiger Wert: ' + wert);
  return wert;
}

function mehrere(werte, liste) {
  if (!Array.isArray(werte)) return '';
  return werte.filter(function (w) { return liste.indexOf(w) !== -1; }).join(', ');
}

function blatt() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

function antwort(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
