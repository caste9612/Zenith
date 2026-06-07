# 04 — Linee guida di design e UX

Obiettivo: interfaccia **molto curata ma non affollata**, ariosa, ben organizzata. Ogni schermata ha **un solo compito**.

## Principi
- **Spazio prima di tutto.** Molto spazio bianco, respiro tra gli elementi, niente cruscotti sovraccarichi.
- **Gerarchia chiara.** Un'informazione primaria per schermata, il resto subordinato visivamente.
- **Palette sobria e coerente**, con un solo colore d'accento. **Dark/light mode**.
- **Tipografia leggibile**, scala tipografica limitata (pochi livelli).
- **Numeri finanziari** ben formattati (separatori migliaia, valuta, segno +/− con colore per gain/loss), allineati a destra in tabelle/liste.
- **Mobile-first**, ma ottimo anche su desktop ampio (Windows): layout responsivo, non solo "mobile stirato".
- **Un toggle, non due grafici.** Quando due viste mostrano la stessa informazione in tagli diversi (per classe vs per intestatario, % vs €), usare un **segmented toggle** su un unico grafico invece di duplicare.

## Design system
Definire e usare token espliciti:
- **Colore:** sfondo, superfici, testo (primario/secondario), accento, positivo (gain), negativo (loss), bordo.
- **Spaziatura:** scala coerente (es. 4/8/12/16/24/32).
- **Tipografia:** famiglia, pesi, dimensioni per titolo/corpo/etichetta/numero.
- **Raggi/ombre:** discreti e uniformi.

## Schermate chiave
- **Dashboard:** in primo piano il **patrimonio netto** con variazione (mese/anno) e grafico storico; sotto, **Ripartizione** (una torta con toggle Classe/Voce/Intestatario), **Composizione nel tempo** (toggle classe/intestatario), **Tasso di risparmio** (%/€, per intestatario, filtro anno) e indicatori.
- **Portafoglio:** elenco posizioni con valore, peso %, P&L; pulsante "Aggiorna" quotazioni ben visibile ma non invadente; stato/orario ultimo aggiornamento.
- **Dettaglio posizione:** azioni rapide "Aggiungi/Vendi"; per i titoli a prezzo manuale (BTP) campo di inserimento chiaro con data.
- **Nuovo snapshot mensile:** form **precompilato** con i valori del mese precedente; si modificano i pochi dati manuali e si salva.
- **Cash flow:** entrate/uscite/risparmio mensili + **tassazione per anno**; pulsante **"Nuovo mese"** per inserire lordo/netto/uscite (tassazione e risparmio calcolati).

## Micro-interazioni
- Aggiunta/vendita posizione in **pochi tap/click**, con conferma e feedback immediato.
- Stati di caricamento/offline chiari ma discreti (Firestore offline è attivo).
