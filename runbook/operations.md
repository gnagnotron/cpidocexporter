# Runbook Operativo

## Avvio

1. Configurare `.env` con credenziali tecniche CPI.
2. Eseguire `npm install`.
3. Avvio single-run: `npm run generate:once`.
4. Avvio scheduler: `npm run generate`.

## Troubleshooting rapido

- Errore OAuth2: verificare `SAP_TOKEN_URL`, `SAP_CLIENT_ID`, `SAP_CLIENT_SECRET`.
- 401/403 su API CPI: controllare ruoli utente tecnico.
- Timeout: alzare `SAP_API_TIMEOUT_MS` e/o ridurre `SAP_API_PAGE_SIZE`.
- Output mancante: verificare permessi filesystem sulla cartella `output`.

## Recovery

- In caso di errore parziale, il sistema usa `output/last-good.json` per mantenere una documentazione consistente.
- Se fallisce anche il fallback, mantenere l'ultimo `index.html` e aprire ticket operativo.

## Ownership

- Team Integration: manutenzione codice e template.
- Team Operations: monitor scheduler e alert.
