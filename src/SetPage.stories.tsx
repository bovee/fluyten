// eslint-disable-next-line storybook/no-renderer-packages
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { userEvent, within, expect } from 'storybook/test';
import { SetPage } from './SetPage';
import { useStore } from './store';
import type { UserSet, UserSong } from './store';

const songs: UserSong[] = [
  {
    id: 'song-1',
    title: 'Greensleeves',
    composer: 'Traditional',
    abc: 'X:1\nT:Greensleeves\nM:3/4\nK:Am\nA2',
  },
  {
    id: 'song-2',
    title: 'Scarborough Fair',
    composer: 'Traditional',
    abc: 'X:1\nT:Scarborough Fair\nM:3/4\nK:Dm\nD2',
  },
  {
    id: 'song-3',
    title: 'Twinkle Twinkle',
    abc: 'X:1\nT:Twinkle\nM:C\nK:C\nC D',
  },
];

const exampleSet: UserSet = {
  id: 'set-1',
  title: 'My Practice Set',
  songIds: ['song-1', 'song-2', 'song-3'],
};

const meta = {
  title: 'Components/SetPage',
  component: SetPage,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    set: exampleSet,
    onBack: fn(),
    onSelectSong: fn(),
  },
  decorators: [
    (Story) => {
      useStore.setState({ songs, sets: [exampleSet] });
      return <Story />;
    },
  ],
} satisfies Meta<typeof SetPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default view of a set with three songs. */
export const WithSongs: Story = {};

/** Empty set — shows the placeholder message. */
export const EmptySet: Story = {
  args: {
    set: { id: 'set-empty', title: 'Empty Set', songIds: [] },
  },
};

/** Clicking a song row calls onSelectSong. */
export const SelectSong: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Greensleeves'));
    expect(args.onSelectSong).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'song-1' }),
      false
    );
  },
};

/** Removing a song from the set updates the store. */
export const RemoveSong: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const removeButtons = await canvas.findAllByRole('button', {
      name: /remove from set/i,
    });
    await userEvent.click(removeButtons[0]);
    // Store should reflect the removal of song-1
    expect(useStore.getState().sets[0].songIds).not.toContain('song-1');
  },
};

/** Opening the edit dialog and saving a new set name. */
export const RenameSet: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: /edit set/i })
    );
    const dialog = await within(document.body).findByRole('dialog');
    const input = within(dialog).getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'Recital Songs');
    await userEvent.click(
      within(dialog).getByRole('button', { name: /^save$/i })
    );
    // Dialog closed, set title updated in store
    expect(useStore.getState().sets[0].title).toBe('Recital Songs');
  },
};

/** Keyboard reordering — ArrowDown moves a song down. */
export const KeyboardReorder: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The ListItemButton for the first song carries the keydown handler
    const firstSongButton = await canvas.findByRole('button', {
      name: /greensleeves.*reorder/i,
    });
    firstSongButton.focus();
    await userEvent.keyboard('{ArrowDown}');
    // Greensleeves should now be at index 1 in the set
    const updatedIds = useStore.getState().sets[0].songIds;
    expect(updatedIds[1]).toBe('song-1');
  },
};
