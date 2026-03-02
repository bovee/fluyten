// eslint-disable-next-line storybook/no-renderer-packages
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { userEvent, within } from 'storybook/test';
import { SongPage } from './SongPage';

const simpleSong = {
  id: 'simple-song',
  title: 'Simple Melody',
  abc: 'X:1\nT:Simple Melody\nM:C\nL:1/4\nK:C\nC D E F | G A B c | c B A G | F E D C |',
};

const meta = {
  title: 'Components/SongPage',
  component: SongPage,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    song: simpleSong,
    onBack: fn(),
    onAbcChange: fn(),
    onTempoChange: fn(),
  },
} satisfies Meta<typeof SongPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithComposer: Story = {
  args: {
    song: {
      id: 'folk-song',
      title: 'Greensleeves',
      abc: 'X:1\nT:Greensleeves\nC:Traditional\nM:3/4\nL:1/4\nK:Am\nA2 c | d3 | c2 A | F3 |',
    },
  },
};

export const EditDrawerOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editButton = await canvas.findByRole('button', {
      name: /edit music/i,
    });
    await userEvent.click(editButton);
  },
};

export const ReadOnly: Story = {
  args: {
    readOnly: true,
  },
};

export const ComplexMusic: Story = {
  args: {
    song: {
      id: 'complex-song',
      title: 'Complex Piece',
      abc: [
        'X:1',
        'T:Complex Piece',
        'M:3/4',
        'L:1/8',
        'K:G',
        '|: G2 AB AG | FD D2 EF | G2 AB cd | e4 de |',
        'f2 ed cB | A2 FA DA | G2 AB AG | F6 :|',
      ].join('\n'),
    },
  },
};
