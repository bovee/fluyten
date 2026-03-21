// eslint-disable-next-line storybook/no-renderer-packages
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { OnboardingDialog } from './OnboardingDialog';
import { useStore } from './store';

const meta = {
  title: 'Components/OnboardingDialog',
  component: OnboardingDialog,
  args: {
    open: true,
    onComplete: fn(),
  },
  decorators: [
    (Story) => {
      // Show the onboarding dialog by setting onboarded: false
      useStore.setState({ onboarded: false });
      return <Story />;
    },
  ],
} satisfies Meta<typeof OnboardingDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Step 1: language selection. */
export const WelcomeStep: Story = {};

/** Step 2: recorder type and fingering system selection. */
export const RecorderStep: Story = {
  play: async () => {
    const { userEvent, within } = await import('storybook/test');
    const body = within(document.body);
    const nextBtn = await body.findByRole('button', { name: /next/i });
    await userEvent.click(nextBtn);
  },
};

/** Skipping onboarding via the Skip button. */
export const SkipOnboarding: Story = {
  args: {
    onComplete: fn(),
  },
};
