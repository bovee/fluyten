// eslint-disable-next-line storybook/no-renderer-packages
import type { Meta, StoryObj } from '@storybook/react';
import { FingeringDiagram } from './FingeringDiagram';
import { Note, Duration } from './music';

const meta = {
  title: 'Components/FingeringDiagram',
  component: FingeringDiagram,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof FingeringDiagram>;

export default meta;
type Story = StoryObj<typeof meta>;

// SOPRANO base pitch is 59, so offset = pitch - 59
// offset 1 = pitch 60 (C4) → all holes closed

export const AllClosed: Story = {
  args: {
    note: new Note(60, Duration.QUARTER), // offset 1 → all closed
  },
};

export const PartiallyOpen: Story = {
  args: {
    note: new Note(63, Duration.QUARTER), // offset 4 → mixed open/closed/half
  },
};

export const GermanFingering: Story = {
  args: {
    note: new Note(65, Duration.QUARTER), // offset 6 → has German fingering variant
    forceGermanSoprano: true,
  },
};

export const AlternateFingerings: Story = {
  args: {
    // offset 11 has two fingering alternatives
    note: new Note(70, Duration.QUARTER),
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
