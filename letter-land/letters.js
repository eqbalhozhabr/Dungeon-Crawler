/*
 * Persian letters used by Letter Land.
 * `ORDER` is the order in which letters are introduced: change it to follow the school book.
 * `word` should contain the letter (the letter is highlighted inside it on screen).
 */
(function (root) {
  'use strict';

  const LETTERS = [
    { ch: 'آ', word: 'آب', emoji: '💧' },
    { ch: 'ا', word: 'اسب', emoji: '🐴' },
    { ch: 'ب', word: 'بادکنک', emoji: '🎈' },
    { ch: 'پ', word: 'پروانه', emoji: '🦋' },
    { ch: 'ت', word: 'توپ', emoji: '⚽' },
    { ch: 'ث', word: 'مثلث', emoji: '🔺' },
    { ch: 'ج', word: 'جوجه', emoji: '🐥' },
    { ch: 'چ', word: 'چتر', emoji: '☂️' },
    { ch: 'ح', word: 'حلزون', emoji: '🐌' },
    { ch: 'خ', word: 'خرگوش', emoji: '🐰' },
    { ch: 'د', word: 'درخت', emoji: '🌳' },
    { ch: 'ذ', word: 'ذرت', emoji: '🌽' },
    { ch: 'ر', word: 'رنگین‌کمان', emoji: '🌈' },
    { ch: 'ز', word: 'زرافه', emoji: '🦒' },
    { ch: 'ژ', word: 'ژاکت', emoji: '🧥' },
    { ch: 'س', word: 'سیب', emoji: '🍎' },
    { ch: 'ش', word: 'شیر', emoji: '🦁' },
    { ch: 'ص', word: 'صابون', emoji: '🧼' },
    { ch: 'ض', word: 'ضربدر', emoji: '✖️' },
    { ch: 'ط', word: 'طوطی', emoji: '🦜' },
    { ch: 'ظ', word: 'ظرف', emoji: '🍽️' },
    { ch: 'ع', word: 'عینک', emoji: '👓' },
    { ch: 'غ', word: 'غذا', emoji: '🍲' },
    { ch: 'ف', word: 'فیل', emoji: '🐘' },
    { ch: 'ق', word: 'قایق', emoji: '⛵' },
    { ch: 'ک', word: 'کتاب', emoji: '📖' },
    { ch: 'گ', word: 'گل', emoji: '🌸' },
    { ch: 'ل', word: 'لیمو', emoji: '🍋' },
    { ch: 'م', word: 'ماهی', emoji: '🐟' },
    { ch: 'ن', word: 'نان', emoji: '🍞' },
    { ch: 'و', word: 'ویولن', emoji: '🎻' },
    { ch: 'ه', word: 'هلو', emoji: '🍑' },
    { ch: 'ی', word: 'یخ', emoji: '🧊' },
  ];

  // letters that look alike: they make the best wrong answers
  const SIMILAR = [
    ['آ', 'ا'], ['ب', 'پ', 'ت', 'ث', 'ن', 'ی'], ['ج', 'چ', 'ح', 'خ'], ['د', 'ذ'], ['ر', 'ز', 'ژ'],
    ['س', 'ش'], ['ص', 'ض'], ['ط', 'ظ'], ['ع', 'غ'], ['ف', 'ق'], ['ک', 'گ'],
  ];

  const api = { LETTERS, SIMILAR };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LetterData = api;
})(typeof window !== 'undefined' ? window : globalThis);
