import beginnerSongsAbc from './books/beginner-songs.abc?raw';

export interface Song {
  id: string;
  title: string;
  abc: string;
  tempo?: number;
}

export interface BuiltInBook {
  id: string;
  title: string;
  abc: string;
  /** i18n key suffixes for each tune, in order (e.g. 'hot-cross-buns' → t('songs.hot-cross-buns')). */
  songKeys: string[];
}

export const BUILT_IN_BOOKS: BuiltInBook[] = [
  {
    id: 'beginner-songs',
    title: 'Beginner Songs',
    abc: beginnerSongsAbc,
    songKeys: ['hot-cross-buns', 'mary-had-a-little-lamb', 'twinkle-twinkle', 'row-row-row-your-boat'],
  },
];
