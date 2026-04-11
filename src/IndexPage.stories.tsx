// eslint-disable-next-line storybook/no-renderer-packages
import type { Meta, StoryObj, Decorator } from '@storybook/react';
import { fn } from 'storybook/test';
import { userEvent, within } from 'storybook/test';
import { IndexPage } from './IndexPage';
import { useStore } from './store';
import type { UserSong } from './store';

const withSongs =
  (songs: UserSong[]): Decorator =>
  (Story) => {
    useStore.setState({ songs });
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
    onSelectSet: fn(),
  },
  decorators: [
    (Story) => {
      useStore.setState({ songs: [] });
      return <Story />;
    },
  ],
} satisfies Meta<typeof IndexPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyState: Story = {};

const manySongs: UserSong[] = [
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
  { id: 's3', title: 'Twinkle Twinkle', abc: 'X:1\nT:Twinkle\nM:C\nK:C\nC D' },
  {
    id: 's4',
    title: 'Hot Cross Buns',
    abc: 'X:1\nT:Hot Cross Buns\nM:C\nK:C\nE D C',
  },
];

export const WithSongs: Story = {
  decorators: [withSongs(manySongs)],
};

/** Opens the Edit Songs dropdown to reveal add/import/select options. */
export const EditSongsMenu: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editButton = await canvas.findByRole('button', {
      name: /edit songs/i,
    });
    await userEvent.click(editButton);
    await within(document.body).findByRole('menu');
  },
};

const oneSong: UserSong[] = [
  {
    id: 's1',
    title: 'Example Song',
    abc: 'X:1\nT:Example\nM:C\nK:C\nC D E F |',
  },
];

/** Opens the Edit Songs menu after entering select mode via Select Songs. */
export const SelectModeMenu: Story = {
  decorators: [withSongs(oneSong)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Enter select mode via Edit Songs → Select Songs
    await userEvent.click(
      await canvas.findByRole('button', { name: /edit songs/i })
    );
    await userEvent.click(
      await within(document.body).findByRole('menuitem', {
        name: /select songs/i,
      })
    );
    // Select the song
    await userEvent.click(
      await canvas.findByRole('button', { name: /select song/i })
    );
    // Reopen menu to show the delete/export options
    await userEvent.click(
      await canvas.findByRole('button', { name: /edit songs/i })
    );
    await within(document.body).findByRole('menu');
  },
};
