# ANNCSU Progress

Dashboard sull’evoluzione della **georeferenziazione dei numeri civici** italiani nell’[Archivio Nazionale dei Numeri Civici delle Strade Urbane (ANNCSU)](https://www.anncsu.gov.it/).

I dati di partenza sono quelli open data scaricabili da
[Accedi ai servizi di download massivo](https://www.anncsu.gov.it/it/consultazione-dellarchivio/open-data/Accedi-ai-servizi-di-dowload-massivo-in-Open-data/).

**Dashboard online:** https://mfortini.github.io/diff_ANNCSU/

Ultimo aggiornamento: **15 settembre 2026** — circa il **75,6%** dei civici risulta georeferenziato.

## Cosa puoi vedere

- L’andamento nazionale nel tempo: quanti civici sono georeferenziati a ogni rilascio
- Mappe interattive a livello Italia, regione e comune
- Tabelle e grafici di completamento e di variazione (nuovi, rimossi, spostati)
- Il confronto tra i rilasci mensili, per capire dove e quanto sta avanzando la copertura

## Dati disponibili nel repository

Oltre alla dashboard, qui trovi anche i dati usati per costruirla:

- **`pmtiles/`** — mappe per ogni versione (rilascio mensile) e punti civici per regione
- **`parquet/anncsu.parquet`** — dataset tabellare con i civici di tutte le versioni

### Contenuto di `anncsu.parquet`

Un unico file (~240 MB) con:

- **13 versioni** mensili (da settembre 2025 a settembre 2026)
- circa **50 milioni** di record (ogni riga è un civico, con flag di presenza nelle varie versioni)
- in totale oltre **360 milioni** di versioni (in media ~27,5 milioni di civici per rilascio)

Rispetto ai CSV originali ANNCSU delle stesse 13 versioni (~2,9 GB già compressi in `.zst`, circa 25 GB se decompressi), il formato Parquet riduce lo spazio a circa **1/12** dei file compressi e a circa **1/100** dei CSV grezzi — senza perdere i dati di tutte le versioni.

## Fonte

I numeri civici e le relative informazioni di georeferenziazione provengono dall’ANNCSU.
Per condizioni di riuso, fare riferimento al portale ufficiale.
