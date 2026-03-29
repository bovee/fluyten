// eslint-disable-next-line storybook/no-renderer-packages
import type { Meta, StoryObj, Decorator } from '@storybook/react';
import { userEvent, within, expect } from 'storybook/test';
import App from './App';
import { useStore } from './store';
import type { UserSong } from './store';

const withSongs =
  (songs: UserSong[]): Decorator =>
  (Story) => {
    useStore.setState({ songs });
    return <Story />;
  };

const meta = {
  title: 'Components/App',
  component: App,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => {
      useStore.setState({ songs: [] });
      return <Story />;
    },
  ],
} satisfies Meta<typeof App>;

export default meta;
type Story = StoryObj<typeof meta>;

const userSong: UserSong = {
  id: 'song-1',
  title: 'Twinkle Twinkle',
  abc: 'X:1\nT:Twinkle Twinkle\nM:C\nL:1/4\nK:C\nC C G G | A A G2 |',
};

/** Navigating from IndexPage to SongPage by clicking a song. */
export const NavigateToSong: Story = {
  decorators: [withSongs([userSong])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click the song to navigate to SongPage
    await userEvent.click(await canvas.findByText('Twinkle Twinkle'));

    // SongPage is now shown — back button and edit button should be present
    await canvas.findByRole('button', { name: /back to song list/i });
    await canvas.findByRole('button', { name: /edit music/i });
  },
};

/** Navigating back from SongPage to IndexPage via the back button. */
export const NavigateBack: Story = {
  decorators: [withSongs([userSong])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByText('Twinkle Twinkle'));
    await canvas.findByRole('button', { name: /back to song list/i });

    // Go back
    await userEvent.click(
      await canvas.findByRole('button', { name: /back to song list/i })
    );

    // IndexPage is restored
    await canvas.findByRole('button', { name: /add song/i });
  },
};

/** ABC edits made in SongPage are persisted to the store and visible when returning. */
export const AbcChangePersisted: Story = {
  decorators: [withSongs([userSong])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByText('Twinkle Twinkle'));

    // Open the edit drawer and change the ABC
    await userEvent.click(
      await canvas.findByRole('button', { name: /edit music/i })
    );
    const editor = await canvas.findByRole('textbox');
    await userEvent.clear(editor);
    await userEvent.type(
      editor,
      'X:1\nT:Edited Song\nM:C\nL:1/4\nK:G\nG A B c |'
    );
    // Wait for the debounce to flush before navigating away.
    await new Promise((r) => setTimeout(r, 400));

    // Navigate back then return to the song (title was renamed to "Edited Song")
    await userEvent.click(
      await canvas.findByRole('button', { name: /back to song list/i })
    );
    await userEvent.click(await canvas.findByText('Edited Song'));
    await userEvent.click(
      await canvas.findByRole('button', { name: /edit music/i })
    );

    // The edited ABC should be persisted
    const editorAfter = await canvas.findByRole('textbox');
    expect((editorAfter as HTMLTextAreaElement).value).toContain('Edited Song');
  },
};
