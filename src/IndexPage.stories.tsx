// eslint-disable-next-line storybook/no-renderer-packages
import type { Meta, StoryObj, Decorator } from '@storybook/react';
import { fn } from 'storybook/test';
import { userEvent, within } from 'storybook/test';
import { IndexPage } from './IndexPage';
import { useStore } from './store';

import type { UserBook } from './store';

const withUserBooks =
  (books: UserBook[]): Decorator =>
  (Story) => {
    useStore.setState({ userBooks: books });
    return <Story />;
  };

const meta = {
  title: 'Components/IndexPage',
  component: IndexPage,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    onSelectSong: fn(),
    expandedBook: false,
    onExpandedBookChange: fn(),
  },
  decorators: [
    (Story) => {
      useStore.setState({ userBooks: [] });
      return <Story />;
    },
  ],
} satisfies Meta<typeof IndexPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyState: Story = {};

const BOOK_1_ID = 'book-1';
const BOOK_2_ID = 'book-2';

const twoBooks = [
  {
    id: BOOK_1_ID,
    title: 'My Favourites',
    songs: [
      {
        id: 's1',
        title: 'Greensleeves',
        abc: 'X:1\nT:Greensleeves\nM:3/4\nK:Am\nA2',
      },
      {
        id: 's2',
        title: 'Scarborough Fair',
        abc: 'X:1\nT:Scarborough Fair\nM:3/4\nK:Dm\nD2',
      },
      {
        id: 's3',
        title: 'Twinkle Twinkle',
        abc: 'X:1\nT:Twinkle\nM:C\nK:C\nC D',
      },
    ],
  },
  {
    id: BOOK_2_ID,
    title: 'Beginner Songs',
    songs: [
      {
        id: 's4',
        title: 'Hot Cross Buns',
        abc: 'X:1\nT:Hot Cross Buns\nM:C\nK:C\nE D C',
      },
    ],
  },
];

export const WithBooks: Story = {
  args: {
    expandedBook: BOOK_1_ID,
  },
  decorators: [withUserBooks(twoBooks)],
};

export const AddBookDialog: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const addBookButton = await canvas.findByRole('button', {
      name: /\+ Add Book/i,
    });
    await userEvent.click(addBookButton);
    await within(document.body).findByRole('dialog');
  },
};

export const BuiltInBooksMenu: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dropdownButton = await canvas.findByRole('button', {
      name: /select built-in book/i,
    });
    await userEvent.click(dropdownButton);
    await within(document.body).findByRole('menu');
  },
};

const oneBook = [
  {
    id: BOOK_1_ID,
    title: 'My Songs',
    songs: [
      {
        id: 's1',
        title: 'Example Song',
        abc: 'X:1\nT:Example\nM:C\nK:C\nC D E F |',
      },
    ],
  },
];

export const BookActions: Story = {
  args: {
    expandedBook: BOOK_1_ID,
  },
  decorators: [withUserBooks(oneBook)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editButton = await canvas.findByRole('button', {
      name: /edit book/i,
    });
    await userEvent.click(editButton);
    await within(document.body).findByRole('dialog');
  },
};
