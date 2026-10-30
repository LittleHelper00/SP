# La Spezia Cruise Guide — handoff per un nuovo assistente

## Cos'è
Prototipo di web app per crocieristi a La Spezia. Un solo file HTML (vanilla JS), mobile-first, 4 lingue (EN/IT/DE/ES).
Build: `python3 build.py` → `dist/index.html` (circa 10 MB, tutto incorporato: dati, CSS, JS, foto come data URI).

## Struttura
- `src/app.js`, `src/styles.css`, `src/template.html`: codice dell'app.
- `data/*.json`: contenuti (places, people, enrich, extra, history, events, food, tours, planner, transport, legal, ui_people, coords, photos).
  `extra.json` contiene voci `extends: <id>` con `storyAppend`, `storyInsert {at, en[]}`, `tipsAppend`, `curiosAppend`, `pverify`, `sources`.
- `data/photos/<id>.jpg` + `credits.csv`; `data/maps/` per le immagini di mappa (nome file con i limiti `_wW_sS_eE_nN`).
- `data/i18n/dict/out_{it,de,es}_*.json`: traduzioni; la chiave è l'intera stringa inglese. `build/missing_i18n.json` deve essere vuoto.
- `tools/ingest_photos.py`, `tools/ingest_maps.py`: importazione foto e mappe.
- Testi con link interni: marcatori `[[id|etichetta]]`.

## Regole fisse del progetto (decise dal proprietario)
1. Non inventare fatti, orari, prezzi: segnalare tutto ciò che non è verificato; tenere separati reale / simulato / segnaposto.
2. Testi per il visitatore scritti in modo diretto: niente "le guide dicono / la stampa locale / le fonti non concordano". Si usa "normalmente". Le fonti e i dubbi restano solo nella sezione "Content status" per il proprietario, in `verify`/`conflicts`/`sources` e nell'elenco "To verify" degli eventi.
3. Rimosse tutte le informazioni pratiche su accessibilità e famiglia (resta solo il filtro/categoria "Famiglia" in Esplora).
4. I riferimenti ad altri luoghi sono link nel testo, mai frasi tipo "questa app ha una pagina su…".
5. Temi e aree (Liberty, Futurismo, Golfo dei Poeti, Cinque Terre) stanno in una sezione "Temi" di Esplora, non sulla mappa.
6. Le etichette dei tour (Facile, Moderato…) devono essere nella lingua scelta.
7. Rispondere al proprietario sempre in italiano. Spiegare in modo semplice. Non fare troppe domande.
8. Le voci "da verificare" restano in sospeso.

## Limiti dell'ambiente "artefatto" di Claude
CSP: niente tile di mappa esterni né immagini remote; tutto deve essere data URI. `tel:`/`mailto:` non affidabili (numeri mostrati come testo + pulsante copia). Fuori dall'artefatto (hosting normale) questi limiti non valgono.

## Stato
Fatto: testi diretti, Oplà, cannoni/Redamare/àncora dell'Alpino sulla Passeggiata Morin, Giardini, gemella di Wagner a Bayreuth, Jazz Festival (evento con regola `range` 8 luglio–4 agosto), trasporti (ATC bus e biglietti, traghetti del Golfo dei Poeti, note nei luoghi fuori città), ostriche, 8 foto dei cibi, 46 foto dei luoghi, traduzioni a 0 mancanti.

Da fare / aperto:
- Mappa reale: servono immagini OSM esportate dal proprietario (vedi `tools/ingest_maps.py`); ora c'è una mappa stilizzata.
- Licenze delle foto: per la maggior parte sconosciute (fonti: Facebook, TripAdvisor, Google, Booking…). OK per un prototipo privato, da liberare o sostituire prima della pubblicazione.
- Domanda aperta: togliere i tempi di viaggio fissi (Portovenere/Lerici/Cinque Terre) e le date calcolate degli eventi? (My Day li usa.)
- Tutte le voci `verify` (da verificare).
- Conflitti di date nei Giardini: monumento a Garibaldi 1913 o 1915; monumento ai caduti 1951 o 1960.
