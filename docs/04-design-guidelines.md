# 04 — Linee guida di design e UX

Obiettivo: interfaccia **molto curata ma non affollata**, ariosa, ben organizzata. Ogni schermata ha **un solo compito**.

## Principi
- **Spazio prima di tutto.** Molto spazio bianco, respiro tra gli elementi, niente cruscotti sovraccarichi.
- **Gerarchia chiara.** Un'informazione primaria per schermata, il resto subordinato visivamente.
- **Palette sobria e coerente**, con un solo colore d'accento. **Dark/light mode**.
- **Tipografia leggibile**, scala tipografica limitata (pochi livelli).
- **Numeri finanziari** ben formattati (separatori migliaia, valuta, segno +/− con colore per gain/loss), allineati a destra in tabelle/liste.
- **Mobile-first**, ma ottimo anche su desktop ampio (Windows): layout responsivo, non solo "mobile stirato".

## Design system
Definire e usare token espliciti:
- **Colore:** sfondo, superfici, testo (primario/secondario), accento, positivo (gain), negativo (loss), bordo.
- **Spaziatura:** scala coerente (es. 4/8/12/16/24/32).
- **Tipografia:** famiglia, pesi, dimensioni per titolo/corpo/etichetta/numero.
- **Raggi/ombre:** discreti e uniformi.

## Schermate chiave
- **Dashboard:** in primo piano il **patrimonio netto** attuale con variazione (mese/anno) e un **grafico storico** pulito; sotto, ripartizione per classe di asset e una sintesi compatta del portafoglio.
- **Portafoglio:** elenco posizioni con valore, peso %, P&L; pulsante "Aggiorna" quotazioni ben visibile ma non invadente; stato/orario ultimo aggiornamento.
- **Dettaglio posizione:** azioni rapide "Aggiungi/Vendi"; per i titoli a prezzo manuale (BTP) campo di inserimento chiaro con data.
- **Nuovo snapshot mensile:** form **precompilato** con i valori del mese precedente; si modificano i pochi dati manuali e si salva.

## Micro-interazioni
- Aggiunta/vendita posizione in **pochi tap/click**, con conferma e feedback immediato.
- Stati di caricamento/offline chiari ma discreti (Firestore offline è attivo).
