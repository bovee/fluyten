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

export const AddSongMenu: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const addButton = await canvas.findByRole('button', { name: /add song/i });
    await userEvent.click(addButton);
  },
};

const oneSong: UserSong[] = [
  {
    id: 's1',
    title: 'Example Song',
    abc: 'X:1\nT:Example\nM:C\nK:C\nC D E F |',
  },
];

export const EditSongDialog: Story = {
  decorators: [withSongs(oneSong)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Select the song first, then open the Edit Songs dialog
    await userEvent.click(
      await canvas.findByRole('button', { name: /select song/i })
    );
    await userEvent.click(
      await canvas.findByRole('button', { name: /edit songs/i })
    );
    await within(document.body).findByRole('dialog');
  },
};
