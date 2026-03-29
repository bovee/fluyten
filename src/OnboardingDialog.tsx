import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import GraphicEq from '@mui/icons-material/GraphicEq';

import { parseAbcFile } from './io/abcImport';
import { Note } from './music';
import { RECORDER_TYPES, getStarterBookUrl } from './instrument';
import { FingeringDiagram } from './FingeringDiagram';
import { RecorderDetector } from './audio/RecorderDetector';
import { useStore, type UserSong } from './store';
import i18n from './i18n';

interface OnboardingDialogProps {
  open: boolean;
  onComplete: () => void;
}

export function OnboardingDialog({ open, onComplete }: OnboardingDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  const language = useStore((state) => state.language);
  const setLanguage = useStore((state) => state.setLanguage);
  const instrumentType = useStore((state) => state.instrumentType);
  const setInstrumentType = useStore((state) => state.setInstrumentType);
  const isGerman = useStore((state) => state.isGerman);
  const setIsGerman = useStore((state) => state.setIsGerman);
  const setTuning = useStore((state) => state.setTuning);
  const importSongs = useStore((state) => state.importSongs);

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
      onStep2Started: () => setDetectStep(1),
      onSystemDetected: (detected) => {
        setIsGerman(detected);
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

  const handleFinish = () => {
    const bookUrl = getStarterBookUrl(useStore.getState().instrumentType);
    onComplete();
    fetch(bookUrl)
      .then((r) => r.text())
      .then((text) => {
        const songs: UserSong[] = parseAbcFile(text).map(({ title, abc }, i) => ({
          id: crypto.randomUUID(),
          title: t(`beginnerSongs.${i}`, { defaultValue: title }),
          abc,
        }));
        importSongs(songs);
      })
      .catch((err) => {
        console.error('Failed to fetch beginner songs:', err);
        alert(
          'Could not download the beginner songs book. You can add it later via "Add Other Book".'
        );
      });
  };

  return (
    <>
      <Dialog open={open} fullWidth maxWidth="sm">
        <DialogTitle>
          {step === 0
            ? t('onboardingWelcomeTitle')
            : t('onboardingRecorderTitle')}
        </DialogTitle>
        <DialogContent>
          {step === 0 ? (
            <Box
              sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}
            >
              <Typography>{t('onboardingWelcomeBody')}</Typography>
              <FormControl fullWidth>
                <InputLabel id="onboard-language-label">
                  {t('language')}
                </InputLabel>
                <Select
                  labelId="onboard-language-label"
                  value={language || i18n.resolvedLanguage || 'en'}
                  label={t('language')}
                  onChange={(e) => {
                    const lang = e.target.value;
                    setLanguage(lang);
                    void i18n.changeLanguage(lang);
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
            </Box>
          ) : (
            <Box
              sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}
            >
              <Typography>{t('onboardingRecorderBody')}</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <FormControl fullWidth>
                  <InputLabel id="onboard-instrument-label">
                    {t('recorderType')}
                  </InputLabel>
                  <Select
                    labelId="onboard-instrument-label"
                    value={instrumentType}
                    label={t('recorderType')}
                    onChange={(e) =>
                      setInstrumentType(
                        e.target.value as keyof typeof RECORDER_TYPES
                      )
                    }
                  >
                    {Object.keys(RECORDER_TYPES)
                      .filter((key) => key !== 'ALL')
                      .map((key) => (
                        <MenuItem key={key} value={key}>
                          {t(`recorderTypes.${key}`)}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
                <Button
                  variant="outlined"
                  startIcon={<GraphicEq />}
                  onClick={() => void openDetect()}
                  sx={{ whiteSpace: 'nowrap', height: 56, px: 2 }}
                >
                  {t('detect')}
                </Button>
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={isGerman}
                    onChange={(e) => setIsGerman(e.target.checked)}
                  />
                }
                label={t('germanFingering')}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFinish}>{t('skip')}</Button>
          {step === 0 ? (
            <Button variant="contained" onClick={() => setStep(1)}>
              {t('next')}
            </Button>
          ) : (
            <Button variant="contained" onClick={handleFinish}>
              {t('getStarted')}
            </Button>
          )}
        </DialogActions>
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
                '& .MuiSlider-track': { transition: 'width 0.1s ease-out' },
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
