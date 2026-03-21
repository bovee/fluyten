import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingDialog } from './OnboardingDialog';
import { useStore } from './store';

vi.mock('./audio/RecorderDetector', () => ({
  RecorderDetector: class {
    start = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn();
    constructor(_cb: unknown) {}
  },
}));

// Prevent handleFinish from actually fetching a book
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  text: () => Promise.resolve('X:1\nT:Beginner Song\nK:C\nC D E F |'),
});
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  useStore.setState({ instrumentType: 'SOPRANO', isGerman: false, language: 'en' });
  mockFetch.mockClear();
});

const renderDialog = (props?: Partial<Parameters<typeof OnboardingDialog>[0]>) =>
  render(
    <OnboardingDialog open={true} onComplete={vi.fn()} {...props} />
  );

describe('OnboardingDialog', () => {
  it('renders when open is true', () => {
    renderDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render dialog content when open is false', () => {
    renderDialog({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('step 0 — welcome', () => {
    it('shows the welcome title', () => {
      renderDialog();
      expect(screen.getByText(/welcome to fluyten/i)).toBeInTheDocument();
    });

    it('shows the language selector', () => {
      renderDialog();
      expect(screen.getByLabelText(/language/i)).toBeInTheDocument();
    });

    it('shows a Skip button', () => {
      renderDialog();
      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    });

    it('shows a Next button', () => {
      renderDialog();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });

    it('Skip calls onComplete', () => {
      const onComplete = vi.fn();
      renderDialog({ onComplete });
      fireEvent.click(screen.getByRole('button', { name: /skip/i }));
      expect(onComplete).toHaveBeenCalled();
    });

    it('Next advances to step 1', () => {
      renderDialog();
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      expect(screen.getByText(/your recorder/i)).toBeInTheDocument();
    });
  });

  describe('step 1 — recorder setup', () => {
    beforeEach(() => {
      renderDialog();
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });

    it('shows the recorder title', () => {
      expect(screen.getByText(/your recorder/i)).toBeInTheDocument();
    });

    it('shows the recorder type selector', () => {
      expect(screen.getByLabelText(/recorder type/i)).toBeInTheDocument();
    });

    it('shows the German fingering toggle', () => {
      expect(screen.getByText(/german system/i)).toBeInTheDocument();
    });

    it('shows the Detect button', () => {
      expect(screen.getByRole('button', { name: /detect/i })).toBeInTheDocument();
    });

    it('shows a Get Started button', () => {
      expect(
        screen.getByRole('button', { name: /get started/i })
      ).toBeInTheDocument();
    });

    it('shows a Skip button', () => {
      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    });

    it('Get Started calls onComplete', () => {
      const onComplete = vi.fn();
      // Re-render so we get a fresh onComplete spy
      render(<OnboardingDialog open={true} onComplete={onComplete} />);
      fireEvent.click(screen.getAllByRole('button', { name: /next/i })[0]);
      fireEvent.click(screen.getByRole('button', { name: /get started/i }));
      expect(onComplete).toHaveBeenCalled();
    });

    it('toggling German fingering updates the store', () => {
      fireEvent.click(screen.getByText(/german system/i));
      expect(useStore.getState().isGerman).toBe(true);
    });
  });
});
