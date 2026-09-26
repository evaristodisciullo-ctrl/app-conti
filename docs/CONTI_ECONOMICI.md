# In Ordine — Conti economici

Questa specifica descrive il comportamento definitivo del modulo **Conti economici**.

## Regole fondamentali

- Il **Saldo attuale** contiene solo denaro realmente disponibile.
- Inserire una nuova Entrata o un nuovo Pagamento **non modifica il saldo**.
- Il saldo aumenta solo quando un'entrata viene confermata **RICEVUTA** con l'importo realmente incassato.
- Il saldo diminuisce solo quando un pagamento viene confermato **PAGATO** con l'importo realmente pagato.
- Una correzione manuale del saldo cambia soltanto il saldo: **non crea movimenti fittizi**.
- Movimenti contiene solo entrate ricevute e pagamenti effettuati.
- Nessuna Entrata o Pagamento di esempio deve essere creato automaticamente.

## Date

Non usare calendari o date picker in nessuna parte dell'app.

Le date si scrivono manualmente, per esempio:
- `10/10/2026`
- `10 ottobre 2026`

Una data non valida mostra un messaggio semplice: **Controlla la data inserita**.

Dopo una data valida, nell'inserimento normale compare **Ripetizione**:
- Una volta
- Ogni mese
- Altro

**Altro** permette:
- ogni X settimane / mesi / anni;
- fine: Mai / Dopo X volte / Il giorno [data scritta manualmente].

## Entrate

Elenco:
- Tutte
- Da ricevere
- Ricevute

Mostra esclusivamente le entrate create dall'utente.
Stato vuoto: **Nessuna entrata inserita.**

Campi principali:
- Nome
- Importo — placeholder `Es. 1000 €`
- Data
- Ripetizione
- Categoria facoltativa
- Notifica facoltativa
- Nota facoltativa

## Pagamenti

Elenco:
- Tutte
- Da pagare
- Pagati

Stati:
- DA PAGARE
- PAGATO
- SCADUTO

Mostra esclusivamente i pagamenti creati dall'utente.
Stato vuoto: **Nessun pagamento inserito.**

## Movimenti

Filtri rapidi:
- Tutte
- Entrate
- Uscite
- Filtra

**Filtra** permette tipo, categoria, voce e periodo.

Ogni movimento mostra nome, data, importo, Entrata/Uscita e apre il dettaglio.
La modifica di un importo già confermato aggiorna il saldo della differenza.

## Ricorrenze e storico

- Le ricorrenze mantengono lo storico già confermato.
- Eliminare o terminare una ricorrenza agisce sulle scadenze future senza cancellare i movimenti passati.
- Una singola occorrenza può essere modificata o eliminata senza distruggere la serie.

## Impostazioni

Devono permettere di trovare e gestire:
- Saldo attuale
- Entrate
- Pagamenti
- Movimenti
- Categorie
- Budget
- Notifiche
- Profilo / nome
- Aspetto e colore
- Sicurezza
- Backup e dati
- Altre impostazioni
- Tutorial dell'app
- Informazioni

## Persistenza e offline

I dati devono restare disponibili dopo chiusura/riapertura dell'app.
La PWA deve continuare a funzionare offline dopo il primo caricamento.
