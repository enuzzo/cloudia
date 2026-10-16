# Precisazione prima del run — guardia UV e ampiezza effettiva

La candidata usa `validUV = m.uv.every(v => v > 0 && v < 1)`, dalle coordinate
originali dopo guessG/s, e `A_eff = validUV ? q.A : 0`. Sigma legge lo streak
alle coordinate originali usando A_eff. **Non viene applicato un gate column.R**
a runtime: richiederebbe la lookup che intendiamo sostituire. L’oracle A ai nodi
continua a valutare il campo originale completo, come nel vecchio audit.

Conservare separati q.A raw e A_eff, comprese comparse/scomparse di supporto e
raw A positiva fuori UV. I gate ottici e contributor-union riguardano A_eff.
Questa precisazione registra l’intenzione già indicata come guardia UV nel
protocollo; nessun nuovo stato o gate numerico, nessuna esecuzione precedente.
