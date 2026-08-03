TP Vertriebscockpit V2.2 – Auswahl einzelner CSV-Datensätze

Neu:
- In der Importvorschau besitzt jede Zeile ein Auswahlkästchen.
- Alle neuen, importierbaren Kunden sind zunächst ausgewählt.
- Über „Alle“ können alle neuen Kunden gemeinsam ausgewählt oder abgewählt werden.
- Bereits vorhandene Kunden, Dubletten und fehlerhafte Zeilen können nicht ausgewählt werden.
- Die Schaltfläche zeigt jederzeit die Anzahl der tatsächlich ausgewählten Kunden.
- Direkt vor dem Import erfolgt weiterhin die zweite Dublettenprüfung.
- Bestehende Kunden werden weiterhin niemals überschrieben.

Test:
1. CSV-Datei auswählen und Vorschau öffnen.
2. Einzelne neue Kunden abwählen.
3. Auswahl über „Alle“ aus- und wieder einschalten.
4. Prüfen, ob Button und Zusammenfassung die Auswahl korrekt zählen.
5. Nur einige Zeilen auswählen und importieren.
6. Prüfen, dass nur ausgewählte Kunden in Firestore angelegt wurden.
