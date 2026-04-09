// eslint-disable-next-line storybook/no-renderer-packages
import type { Meta, StoryObj } from '@storybook/react';
import { FingeringDiagram } from './FingeringDiagram';
import { Note, Duration } from './music';
import { useStore } from './store';

const meta = {
  title: 'Components/FingeringDiagram',
  component: FingeringDiagram,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => {
      useStore.setState({ instrumentType: 'SOPRANO', isGerman: false });
      return <Story />;
    },
  ],
} satisfies Meta<typeof FingeringDiagram>;

export default meta;
type Story = StoryObj<typeof meta>;

// SOPRANO basePitch = 72, so pitch = 71 + offset

export const AllClosed: Story = {
  args: {
    note: new Note(72, Duration.QUARTER), // offset 1 → all holes closed (C5)
  },
};

export const PartiallyOpen: Story = {
  args: {
    note: new Note(75, Duration.QUARTER), // offset 4 → mixed open/closed/half (Eb5)
  },
};

export const GermanFingering: Story = {
  args: {
    note: new Note(77, Duration.QUARTER), // offset 6 → has German fingering variant (F5)
    forceGermanSoprano: true,
  },
};

export const AlternateFingerings: Story = {
  args: {
    note: new Note(82, Duration.QUARTER), // offset 11 → two fingering alternatives (Bb5)
  },
};

export const Trill: Story = {
  args: {
    note: new Note(82, Duration.QUARTER, ['trill']), // offset 11 → has trill fingering
  },
};

export const OutOfRange: Story = {
  args: {
    // Pitch far outside the fingering table
    note: new Note(30, Duration.QUARTER),
  },
};

export const Rest: Story = {
  args: {
    note: new Note(undefined, Duration.QUARTER),
  },
};
