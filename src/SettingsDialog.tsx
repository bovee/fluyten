import { useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import GraphicEq from '@mui/icons-material/GraphicEq';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { useTranslation } from 'react-i18next';
import TextField from '@mui/material/TextField';
import { useStore } from './store';
import { RECORDER_TYPES } from './instrument';
import { noteNameToMidi } from './audio/utils';
import { METHODS_FOR_INSTRUMENT, METHOD_DISPLAY_NAMES } from './method';
import { FingeringDiagram } from './FingeringDiagram';
import { RecorderDetector } from './audio/RecorderDetector';
import { Note } from './music';
import i18n from './i18n';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKS = 13;

function cellColor(count: number, hover: string): string {
  if (count === 0) return hover;
  if (count <= 2) return '#86efac';
  if (count <= 4) return '#22c55e';
  return '#15803d';
}

function PracticeHeatmap() {
  const { t } = useTranslation();
  const theme = useTheme();
  const practiceCalendar = useStore((s) => s.practiceCalendar);
  const [offset, setOffset] = useState(0);

  // Build array of 91 Date objects (oldest first), ending at today - offset*7
  const today = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - offset * 7);
  // Align endDate to the end of its week (Saturday)
  const endDow = endDate.getDay(); // 0=Sun..6=Sat
  const daysToSat = 6 - endDow;
  endDate.setDate(endDate.getDate() + daysToSat);

  const days: Date[] = [];
  for (let i = WEEKS * 7 - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - i);
    days.push(d);
  }

  const getCount = (d: Date) => {
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    return practiceCalendar[key]?.[d.getDate()] ?? 0;
  };

  const isRtl = theme.direction === 'rtl';
  const columns = Array.from({ length: WEEKS }, (_, i) => i);
  const displayCols = isRtl ? [...columns].reverse() : columns;

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <IconButton
          size="small"
          onClick={() => setOffset((o) => o + 4)}
          aria-label="previous weeks"
        >
          <ChevronLeft />
        </IconButton>
        <Typography variant="body2" sx={{ flex: 1, textAlign: 'center' }}>
          {t('practiceHistory')}
        </Typography>
        <IconButton
          size="small"
          onClick={() => setOffset((o) => Math.max(0, o - 4))}
          disabled={offset === 0}
          aria-label="next weeks"
        >
          <ChevronRight />
        </IconButton>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `20px repeat(${WEEKS}, 20px)`,
          gridTemplateRows: `repeat(7, 20px)`,
          gap: '2px',
        }}
      >
        {DAY_LABELS.map((label, row) => (
          <Typography
            key={row}
            variant="caption"
            sx={{
              gridColumn: 1,
              gridRow: row + 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: 'text.secondary',
            }}
          >
            {label}
          </Typography>
        ))}
        {displayCols.map((weekIdx, colPos) =>
          Array.from({ length: 7 }, (_, dow) => {
            const dayIndex = weekIdx * 7 + dow;
            const d = days[dayIndex];
            const count = getCount(d);
            const isToday =
              d.getFullYear() === today.getFullYear() &&
              d.getMonth() === today.getMonth() &&
              d.getDate() === today.getDate();
            const isMonthStart = d.getDate() === 1;
            const dateStr = d.toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });
            return (
              <Tooltip
                key={`${weekIdx}-${dow}`}
                title={`${dateStr} — ${count}`}
              >
                <Box
                  sx={{
                    gridColumn: colPos + 2,
                    gridRow: dow + 1,
                    width: 20,
                    height: 20,
                    borderRadius: '3px',
                    bgcolor: cellColor(count, theme.palette.action.hover),
                    ...(isToday && {
                      outline: `2px solid ${theme.palette.text.secondary}`,
                    }),
                    ...(isMonthStart && {
                      borderTop: `2px solid ${theme.palette.text.secondary}`,
                    }),
                  }}
                />
              </Tooltip>
            );
          })
        )}
      </Box>
    </Box>
  );
}

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { t } = useTranslation();
  const instrumentType = useStore((state) => state.instrumentType);
  const setInstrumentType = useStore((state) => state.setInstrumentType);
  const customBasePitchStr = useStore((state) => state.customBasePitchStr);
  const setCustomBasePitch = useStore((state) => state.setCustomBasePitch);
  const customHighNoteStr = useStore((state) => state.customHighNoteStr);
  const setCustomHighNote = useStore((state) => state.setCustomHighNote);
  const tuning = useStore((state) => state.tuning);
  const setTuning = useStore((state) => state.setTuning);
  const isGerman = useStore((state) => state.isGerman);
  const setIsGerman = useStore((state) => state.setIsGerman);
  const language = useStore((state) => state.language);
  const setLanguage = useStore((state) => state.setLanguage);
  const colorMode = useStore((state) => state.colorMode);
  const setColorMode = useStore((state) => state.setColorMode);
  const method = useStore((state) => state.method);
  const setMethod = useStore((state) => state.setMethod);
  const tempo = useStore((state) => state.tempo);
  const setTempo = useStore((state) => state.setTempo);
  const playbackVoices = useStore((state) => state.playbackVoices);
  const setPlaybackVoices = useStore((state) => state.setPlaybackVoices);
  const practiceMode = useStore((state) => state.practiceMode);
  const setPracticeMode = useStore((state) => state.setPracticeMode);
  const playMetronome = useStore((state) => state.playMetronome);
  const setPlayMetronome = useStore((state) => state.setPlayMetronome);
  const autoScroll = useStore((state) => state.autoScroll);
  const setAutoScroll = useStore((state) => state.setAutoScroll);

  const [tab, setTab] = useState(0);
  const [detectOpen, setDetectOpen] = useState(false);
  const [detectStep, setDetectStep] = useState<0 | 1>(0);
  const [detectedVolume, setDetectedVolume] = useState(0);
  const detectorRef = useRef<RecorderDetector | null>(null);

  const closeDetect = () => {
    detectorRef.current?.stop();
    detectorRef.current = null;
    setDetectOpen(false);
  };

  const openDetect = async () => {
    setDetectOpen(true);
    setDetectStep(0);
    const detector = new RecorderDetector({
      onVolume: setDetectedVolume,
      onRecorderDetected: (recorder, tuning) => {
        setInstrumentType(recorder);
        setTuning(tuning);
      },
      onStep2Started: () => {
        setDetectStep(1);
      },
      onSystemDetected: (isGerman) => {
        setIsGerman(isGerman);
        closeDetect();
      },
      onError: (err) => {
        alert(`${t('micError')}: ${err.message}`);
        setDetectOpen(false);
      },
    });
    detectorRef.current = detector;
    try {
      await detector.start();
    } catch (err) {
      alert(`${t('micError')}: ${(err as Error).message}`);
      setDetectOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>{t('settings')}</DialogTitle>
        <DialogContent sx={{ px: 0, pb: 0 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label={t('settingsTabGeneral')} />
            <Tab label={t('settingsTabInstrument')} />
            <Tab label={t('settingsTabPractice')} />
          </Tabs>

          {tab === 0 && (
            <Box
              sx={{
                px: 3,
                pt: 3,
                pb: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <FormControl fullWidth>
                <InputLabel id="language-label">{t('language')}</InputLabel>
                <Select
                  labelId="language-label"
                  value={language || i18n.resolvedLanguage || 'en'}
                  label={t('language')}
                  onChange={(e) => {
                    const lang = e.target.value;
                    setLanguage(lang);
                    i18n.changeLanguage(lang);
                  }}
                >
                  <MenuItem value="ar" dir="rtl">
                    العربية
                  </MenuItem>
                  <MenuItem value="bn">বাংলা</MenuItem>
                  <MenuItem value="ur" dir="rtl">
                    اردو
                  </MenuItem>
                  <MenuItem value="zh-Hans">中文（简体）</MenuItem>
                  <MenuItem value="zh-Hant">中文（繁體）</MenuItem>
                  <MenuItem value="yue">粵語</MenuItem>
                  <MenuItem value="cs">Čeština</MenuItem>
                  <MenuItem value="da">Dansk</MenuItem>
                  <MenuItem value="de">Deutsch</MenuItem>
                  <MenuItem value="el">Ελληνικά</MenuItem>
                  <MenuItem value="et">Eesti</MenuItem>
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="es">Español</MenuItem>
                  <MenuItem value="tl">Filipino</MenuItem>
                  <MenuItem value="fr">Français</MenuItem>
                  <MenuItem value="gu">ગુજરાતી</MenuItem>
                  <MenuItem value="ha">Hausa</MenuItem>
                  <MenuItem value="hi">हिन्दी</MenuItem>
                  <MenuItem value="hr">Hrvatski</MenuItem>
                  <MenuItem value="fa" dir="rtl">
                    فارسی
                  </MenuItem>
                  <MenuItem value="fi">Suomi</MenuItem>
                  <MenuItem value="he" dir="rtl">
                    עברית
                  </MenuItem>
                  <MenuItem value="hu">Magyar</MenuItem>
                  <MenuItem value="id">Bahasa Indonesia</MenuItem>
                  <MenuItem value="jv">Basa Jawa</MenuItem>
                  <MenuItem value="sw">Kiswahili</MenuItem>
                  <MenuItem value="ko">한국어</MenuItem>
                  <MenuItem value="mr">मराठी</MenuItem>
                  <MenuItem value="it">Italiano</MenuItem>
                  <MenuItem value="ja">日本語</MenuItem>
                  <MenuItem value="nl">Nederlands</MenuItem>
                  <MenuItem value="nb">Norsk</MenuItem>
                  <MenuItem value="pa">ਪੰਜਾਬੀ</MenuItem>
                  <MenuItem value="pl">Polski</MenuItem>
                  <MenuItem value="pt">Português</MenuItem>
                  <MenuItem value="ro">Română</MenuItem>
                  <MenuItem value="ru">Русский</MenuItem>
                  <MenuItem value="sk">Slovenčina</MenuItem>
                  <MenuItem value="sv">Svenska</MenuItem>
                  <MenuItem value="ta">தமிழ்</MenuItem>
                  <MenuItem value="te">తెలుగు</MenuItem>
                  <MenuItem value="th">ภาษาไทย</MenuItem>
                  <MenuItem value="uk">Українська</MenuItem>
                  <MenuItem value="vi">Tiếng Việt</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="color-mode-label">{t('colorMode')}</InputLabel>
                <Select
                  labelId="color-mode-label"
                  value={colorMode}
                  label={t('colorMode')}
                  onChange={(e) =>
                    setColorMode(e.target.value as 'system' | 'light' | 'dark')
                  }
                >
                  <MenuItem value="system">{t('colorModeSystem')}</MenuItem>
                  <MenuItem value="light">{t('colorModeLight')}</MenuItem>
                  <MenuItem value="dark">{t('colorModeDark')}</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="playback-voices-label">
                  {t('playbackVoices')}
                </InputLabel>
                <Select
                  labelId="playback-voices-label"
                  value={playbackVoices}
                  label={t('playbackVoices')}
                  onChange={(e) =>
                    setPlaybackVoices(e.target.value as typeof playbackVoices)
                  }
                >
                  <MenuItem value="selected">
                    {t('playbackVoicesSelected')}
                  </MenuItem>
                  <MenuItem value="others">
                    {t('playbackVoicesOthers')}
                  </MenuItem>
                  <MenuItem value="all">{t('playbackVoicesAll')}</MenuItem>
                </Select>
              </FormControl>

              <Box>
                <Typography
                  id="tempo-slider-label"
                  variant="caption"
                  color="text.secondary"
                >
                  {t('tempoLabel', { tempo })}
                </Typography>
                <Slider
                  aria-labelledby="tempo-slider-label"
                  size="small"
                  value={tempo}
                  onChange={(_, v) => setTempo(v as number)}
                  min={20}
                  max={200}
                  step={5}
                />
              </Box>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                  />
                }
                label={t('autoScroll')}
              />
            </Box>
          )}

          {tab === 1 && (
            <Box
              sx={{
                px: 3,
                pt: 3,
                pb: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <FormControl fullWidth>
                  <InputLabel id="instrument-type-label">
                    {t('recorderType')}
                  </InputLabel>
                  <Select
                    labelId="instrument-type-label"
                    id="instrument-type-select"
                    value={instrumentType ?? 'OTHER'}
                    label={t('recorderType')}
                    onChange={(e) => {
                      const v = e.target.value as string;
                      setInstrumentType(
                        v === 'OTHER'
                          ? null
                          : (v as keyof typeof RECORDER_TYPES)
                      );
                    }}
                  >
                    {Object.keys(RECORDER_TYPES).map((key) => (
                      <MenuItem key={key} value={key}>
                        {t(`recorderTypes.${key}`)}
                      </MenuItem>
                    ))}
                    <MenuItem value="OTHER">
                      {t('recorderTypes.OTHER')}
                    </MenuItem>
                  </Select>
                </FormControl>
                <Button
                  variant="outlined"
                  startIcon={<GraphicEq />}
                  onClick={openDetect}
                  sx={{
                    whiteSpace: 'nowrap',
                    height: 56,
                    px: 2,
                    '& .MuiButton-startIcon': { mr: 0.5 },
                  }}
                >
                  {t('detect')}
                </Button>
              </Box>

              {instrumentType === null && (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label={t('customBasePitch')}
                    value={customBasePitchStr}
                    onChange={(e) => setCustomBasePitch(e.target.value)}
                    error={noteNameToMidi(customBasePitchStr) === null}
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label={t('customHighNote')}
                    value={customHighNoteStr}
                    onChange={(e) => setCustomHighNote(e.target.value)}
                    error={
                      noteNameToMidi(customHighNoteStr) === null ||
                      (noteNameToMidi(customHighNoteStr) ?? 0) <=
                        (noteNameToMidi(customBasePitchStr) ?? 0)
                    }
                    size="small"
                    fullWidth
                  />
                </Box>
              )}

              <FormControlLabel
                control={
                  <Switch
                    checked={isGerman}
                    onChange={(e) => setIsGerman(e.target.checked)}
                  />
                }
                label={t('germanFingering')}
              />

              <Box>
                <Typography id="tuning-slider" gutterBottom>
                  {t('tuningRatio', { tuning: tuning.toFixed(2) })}
                </Typography>
                <Slider
                  aria-labelledby="tuning-slider"
                  value={tuning}
                  onChange={(_, newValue) => setTuning(newValue as number)}
                  valueLabelDisplay="auto"
                  step={0.01}
                  min={0.8}
                  max={1.2}
                />
              </Box>

              <FormControl fullWidth>
                <InputLabel id="method-label">{t('method')}</InputLabel>
                <Select
                  labelId="method-label"
                  value={method}
                  label={t('method')}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <MenuItem value="none">{t('methodNone')}</MenuItem>
                  {(instrumentType
                    ? METHODS_FOR_INSTRUMENT[instrumentType]
                    : []
                  ).map((m) => (
                    <MenuItem key={m} value={m}>
                      {METHOD_DISPLAY_NAMES[m]}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>{t('methodHelperText')}</FormHelperText>
              </FormControl>
            </Box>
          )}

          {tab === 2 && (
            <Box
              sx={{
                px: 3,
                pt: 3,
                pb: 3,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <FormControl fullWidth>
                <InputLabel id="practice-mode-label">
                  {t('practiceMode')}
                </InputLabel>
                <Select
                  labelId="practice-mode-label"
                  value={practiceMode}
                  label={t('practiceMode')}
                  onChange={(e) =>
                    setPracticeMode(e.target.value as typeof practiceMode)
                  }
                >
                  <MenuItem value="metronome-only">
                    {t('practiceDontCheck')}
                  </MenuItem>
                  <MenuItem value="correct-then-advance">
                    {t('practiceAsPlayed')}
                  </MenuItem>
                  <MenuItem value="in-tempo">{t('practiceRealTime')}</MenuItem>
                </Select>
              </FormControl>

              <FormControlLabel
                disabled={practiceMode === 'metronome-only'}
                control={
                  <Checkbox
                    checked={playMetronome}
                    onChange={(e) => setPlayMetronome(e.target.checked)}
                  />
                }
                label={t('playMetronome')}
              />
              <PracticeHeatmap />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={detectOpen} onClose={closeDetect} fullWidth maxWidth="xs">
        <DialogTitle>{t('detectRecorderType')}</DialogTitle>
        <DialogContent>
          <Stepper activeStep={detectStep} sx={{ mb: 3 }}>
            <Step>
              <StepLabel>{t('recorderType')}</StepLabel>
            </Step>
            <Step>
              <StepLabel>{t('germanFingering')}</StepLabel>
            </Step>
          </Stepper>
          <Typography variant="body1" sx={{ mb: 3 }}>
            {detectStep === 0
              ? t('detectInstructions')
              : t('detectSystemInstructions')}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <FingeringDiagram
              note={new Note(detectStep === 0 ? 71 : 65)}
              forceGermanSoprano
            />
          </Box>
          <Box sx={{ py: 2 }}>
            <Slider
              value={detectedVolume}
              min={0}
              max={1}
              step={0.01}
              disabled
              sx={{
                '& .MuiSlider-thumb': { display: 'none' },
                '& .MuiSlider-track': {
                  transition: 'width 0.1s ease-out',
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDetect}>{t('close')}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
