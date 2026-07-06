/**
 * questions.js
 * ---------------------------------------------------------------------------
 * Die 16 Quiz-Fragen des Hochzeitsspiels ("Wer von beiden...?").
 * Jede Frage hat zwei feste Antwortmöglichkeiten - Lara (rosa) und
 * Nathanael (hellblau) - und optional ein Bild.
 *
 * Leicht editierbar: einfach die Texte / Bildpfade unten anpassen oder
 * weitere Objekte zum Array hinzufügen. Die App liest die Länge des Arrays
 * automatisch aus (Moderator-Navigation "nächste/vorherige Frage" stoppt
 * automatisch am Anfang/Ende).
 *
 * image: Pfad zu /assets/images/. Existiert die Datei nicht, zeigt die App
 * automatisch einen dekorativen Platzhalter an (siehe display.js).
 * ---------------------------------------------------------------------------
 */

export const ANSWER_A_LABEL = 'Lara';
export const ANSWER_B_LABEL = 'Nathanael';

export const questions = [
  {
    frage: 'Wer ist ordentlicher?',
    bild: 'assets/images/q01.jpg',
  },
  {
    frage: 'Wer besitzt mehr Schuhe?',
    bild: 'assets/images/q02.jpg',
  },
  {
    frage: 'Wer putzt gründlicher die Zähne?',
    bild: 'assets/images/q03.jpg',
  },
  {
    frage: 'Wer hat mehr Follower auf Instagram?',
    bild: 'assets/images/q04.jpg',
  },
  {
    frage: 'Wer braucht länger unter der Dusche?',
    bild: 'assets/images/q05.jpg',
  },
  {
    frage: 'Wer hat immer recht?',
    bild: 'assets/images/q06.jpg',
  },
  {
    frage: 'Wer ist romantischer?',
    bild: 'assets/images/q07.jpg',
  },
  {
    frage: 'Wer ist vergesslicher?',
    bild: 'assets/images/q08.jpg',
  },
  {
    frage: 'Wer schläft schneller ein?',
    bild: 'assets/images/q09.jpg',
  },
  {
    frage: 'Wer sagt öfter "Ich liebe dich"?',
    bild: 'assets/images/q10.jpg',
  },
  {
    frage: 'Wer möchte mehr Kinder?',
    bild: 'assets/images/q11.jpg',
  },
  {
    frage: 'Wer übertreibt öfter?',
    bild: 'assets/images/q12.jpg',
  },
  {
    frage: 'Wer gibt mehr Geld für Schuhe aus?',
    bild: 'assets/images/q13.jpg',
  },
  {
    frage: 'Wer wird an Weihnachten zuerst sentimental?',
    bild: 'assets/images/q14.jpg',
  },
  {
    frage: 'Wer hat die Hochzeit spontaner geplant?',
    bild: 'assets/images/q15.jpg',
  },
  {
    frage: 'Wer wird in 10 Jahren öfter Karaoke singen?',
    bild: 'assets/images/q16.jpg',
  },
];
