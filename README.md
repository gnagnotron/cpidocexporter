# SAP CPI Documentation Automation

Generatore di documentazione HTML per iFlow SAP CPI (Integration Suite), con due modalita:

- CLI locale (schedulabile)
- Web app (deployabile su Render) con input Service Key JSON e download diretto dell'HTML

## Requisiti

- Node.js 20+
- Service Key SAP valida con permessi API CPI

## Modalita Web (consigliata per condivisione)

Avvio locale:

1. Installa dipendenze:

   ```bash
   npm install
   ```

2. Avvia web server:

   ```bash
   npm run start:web
   ```

3. Apri nel browser:

   ```
   http://localhost:3000
   ```

4. Incolla la Service Key JSON (o carica file), genera, scarica HTML.

Note:

- La Service Key viene elaborata in memoria durante la richiesta.
- Il report viene restituito come download HTML.

## Deploy su Render (Free)

Questo repository include `render.yaml` pronto all'uso.

Passi:

1. Pubblica il progetto su GitHub.
2. In Render crea un nuovo Blueprint o Web Service dal repo.
3. Render usera:
   - Build: `npm install`
   - Start: `npm run start:web`
4. Una volta online, condividi l'URL della web app.

Health endpoint:

- `GET /health`

## Modalita CLI (locale/scheduler)

1. Copia e configura ambiente:

   ```bash
   copy .env.example .env
   ```

2. Esegui una generazione singola:

   ```bash
   npm run generate:once
   ```

3. Avvia scheduler giornaliero:

   ```bash
   npm run generate
   ```

## Output CLI

- `output/index.html`: documentazione aggiornata.
- `output/latest.json`: modello dati canonico dell'ultimo run.
- `output/last-good.json`: fallback valido in caso di errore parziale.

## Sicurezza

- Non committare mai Service Key o file con segreti.
- Le credenziali reali sono mascherate dove necessario.
- Alias Security Material (es. `S4_Credentials`) possono restare visibili come riferimento, non sono credenziali in chiaro.

## Copertura funzionale

- Catalogo iFlow (nome, package, versione, stato)
- Endpoint e adapter
- Parametri esternalizzati e Security Material alias
- Error handling e retry path
- Mappa dipendenze tra artefatti

## Documentazione tecnica

- `docs/implementation-spec.md`
- `runbook/operations.md`
