import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('./utils', () => ({
  debounce: (fn: (...args: unknown[]) => void) => ({ call: fn, cancel: vi.fn() }),
}));
import { EditorDrawer } from './EditorDrawer';
import { useStore } from './store';
import { Music } from './music';

vi.mock('./audio/FrequencyTracker', () => ({
  FrequencyTracker: class {
    constructor(_onStart: unknown, _onStop: unknown) {}
    start = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn();
    checkFrequency = vi.fn();
  },
}));

const SIMPLE_ABC = 'X:1\nT:Test\nK:C\nC D E F |';

const defaultProps = (overrides = {}) => ({
  open: true,
  abcMusic: SIMPLE_ABC,
  onAbcChange: vi.fn(),
  tempo: 120,
  onTempoChange: vi.fn(),
  voices: [{ id: 'V1', name: 'Voice 1', music: new Music() }],
  selectedVoiceIdx: 0,
  onVoiceChange: vi.fn(),
  parseError: '',
  ...overrides,
});

beforeEach(() => {
  useStore.setState({ instrumentType: 'SOPRANO', tuning: 1.0 });
});

describe('EditorDrawer', () => {
  it('renders the ABC textarea with the current value', () => {
    render(<EditorDrawer {...defaultProps()} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue(SIMPLE_ABC);
  });

  it('calls onAbcChange when the textarea is edited', () => {
    const onAbcChange = vi.fn();
    render(<EditorDrawer {...defaultProps({ onAbcChange })} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'X:1\nK:G\nG' } });
    expect(onAbcChange).toHaveBeenCalledWith('X:1\nK:G\nG');
  });

  it('disables the textarea when readOnly', () => {
    render(<EditorDrawer {...defaultProps({ readOnly: true })} />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('does not disable the textarea in normal mode', () => {
    render(<EditorDrawer {...defaultProps()} />);
    expect(screen.getByRole('textbox')).not.toBeDisabled();
  });

  it('shows a parse error message when parseError is non-empty', () => {
    render(
      <EditorDrawer {...defaultProps({ parseError: 'Bad key signature' })} />
    );
    expect(screen.getByText('Bad key signature')).toBeInTheDocument();
  });

  it('does not show a parse error when parseError is empty', () => {
    render(<EditorDrawer {...defaultProps({ parseError: '' })} />);
    expect(screen.queryByText('Bad key signature')).not.toBeInTheDocument();
  });

  it('renders the tempo slider with the current tempo', () => {
    render(<EditorDrawer {...defaultProps({ tempo: 90 })} />);
    expect(screen.getByRole('slider', { name: /tempo/i })).toHaveValue('90');
  });

  it('calls onTempoChange when the tempo slider changes', () => {
    const onTempoChange = vi.fn();
    render(<EditorDrawer {...defaultProps({ onTempoChange })} />);
    const slider = screen.getByRole('slider', { name: /tempo/i });
    fireEvent.change(slider, { target: { value: '80' } });
    expect(onTempoChange).toHaveBeenCalled();
  });

  describe('voice selector', () => {
    it('is hidden when there is only one voice', () => {
      render(
        <EditorDrawer
          {...defaultProps({ voices: [{ id: 'V1', name: 'Solo' }] })}
        />
      );
      expect(screen.queryByLabelText(/voice/i)).not.toBeInTheDocument();
    });

    it('is shown when there are multiple voices', () => {
      render(
        <EditorDrawer
          {...defaultProps({
            voices: [
              { id: 'V1', name: 'Soprano' },
              { id: 'V2', name: 'Alto' },
            ],
          })}
        />
      );
      expect(screen.getByLabelText(/voice/i)).toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('renders the transcribe button', () => {
      render(<EditorDrawer {...defaultProps()} />);
      expect(
        screen.getByRole('button', { name: /transcribe/i })
      ).toBeInTheDocument();
    });

    it('disables the transcribe button when readOnly', () => {
      render(<EditorDrawer {...defaultProps({ readOnly: true })} />);
      expect(
        screen.getByRole('button', { name: /transcribe/i })
      ).toBeDisabled();
    });

    it('renders the reflow button', () => {
      render(<EditorDrawer {...defaultProps()} />);
      expect(
        screen.getByRole('button', { name: /reflow/i })
      ).toBeInTheDocument();
    });

    it('disables the reflow button when readOnly', () => {
      render(<EditorDrawer {...defaultProps({ readOnly: true })} />);
      expect(screen.getByRole('button', { name: /reflow/i })).toBeDisabled();
    });

    it('reflow calls onAbcChange with reformatted ABC', () => {
      const onAbcChange = vi.fn();
      render(<EditorDrawer {...defaultProps({ onAbcChange })} />);
      fireEvent.click(screen.getByRole('button', { name: /reflow/i }));
      expect(onAbcChange).toHaveBeenCalled();
    });

    it('renders the transform button', () => {
      render(<EditorDrawer {...defaultProps()} />);
      expect(
        screen.getByRole('button', { name: /transform/i })
      ).toBeInTheDocument();
    });

    it('transform button is disabled when there is no text selection', () => {
      render(<EditorDrawer {...defaultProps()} />);
      expect(screen.getByRole('button', { name: /transform/i })).toBeDisabled();
    });

    it('transform button is enabled when notes are selected', () => {
      render(<EditorDrawer {...defaultProps()} />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      // Notes start after 'X:1\nT:Test\nK:C\n' = position 15
      Object.defineProperty(textarea, 'selectionStart', {
        value: 15,
        configurable: true,
      });
      Object.defineProperty(textarea, 'selectionEnd', {
        value: 20,
        configurable: true,
      });
      fireEvent.select(textarea);
      expect(
        screen.getByRole('button', { name: /transform/i })
      ).not.toBeDisabled();
    });

    it('transform button is disabled when selection is in the header', () => {
      render(<EditorDrawer {...defaultProps()} />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      Object.defineProperty(textarea, 'selectionStart', {
        value: 0,
        configurable: true,
      });
      Object.defineProperty(textarea, 'selectionEnd', {
        value: 5,
        configurable: true,
      });
      fireEvent.select(textarea);
      expect(screen.getByRole('button', { name: /transform/i })).toBeDisabled();
    });

    it('clicking transform button opens the transform menu', () => {
      render(<EditorDrawer {...defaultProps()} />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      Object.defineProperty(textarea, 'selectionStart', {
        value: 15,
        configurable: true,
      });
      Object.defineProperty(textarea, 'selectionEnd', {
        value: 20,
        configurable: true,
      });
      fireEvent.select(textarea);
      fireEvent.click(screen.getByRole('button', { name: /transform/i }));
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('transform menu contains octave shift options', () => {
      render(<EditorDrawer {...defaultProps()} />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      Object.defineProperty(textarea, 'selectionStart', {
        value: 15,
        configurable: true,
      });
      Object.defineProperty(textarea, 'selectionEnd', {
        value: 20,
        configurable: true,
      });
      fireEvent.select(textarea);
      fireEvent.click(screen.getByRole('button', { name: /transform/i }));
      expect(
        screen.getByRole('menuitem', { name: /octave up/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitem', { name: /octave down/i })
      ).toBeInTheDocument();
    });
  });
});
