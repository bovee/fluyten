import { useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import GraphicEq from '@mui/icons-material/GraphicEq';
import { useTranslation } from 'react-i18next';
import { useStore } from './store';
import { RECORDER_TYPES } from './instrument';
import { FingeringDiagram } from './FingeringDiagram';
import { RecorderDetector } from './RecorderDetector';
import { Note } from './music';
import i18n from './i18n';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { t } = useTranslation();
  const instrumentType = useStore((state) => state.instrumentType);
  const setInstrumentType = useStore((state) => state.setInstrumentType);
  const tuning = useStore((state) => state.tuning);
  const setTuning = useStore((state) => state.setTuning);
  const isGerman = useStore((state) => state.isGerman);
  const setIsGerman = useStore((state) => state.setIsGerman);
  const language = useStore((state) => state.language);
  const setLanguage = useStore((state) => state.setLanguage);

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
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Box>
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
                  <MenuItem value="zh-Hans">中文</MenuItem>
                  <MenuItem value="de">Deutsch</MenuItem>
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="es">Español</MenuItem>
                  <MenuItem value="fr">Français</MenuItem>
                  <MenuItem value="hi">हिन्दी</MenuItem>
                  <MenuItem value="id">Bahasa Indonesia</MenuItem>
                  <MenuItem value="ja">日本語</MenuItem>
                  <MenuItem value="ko">한국어</MenuItem>
                  <MenuItem value="pt">Português</MenuItem>
                  <MenuItem value="ru">Русский</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <FormControl fullWidth>
                <InputLabel id="instrument-type-label">
                  {t('recorderType')}
                </InputLabel>
                <Select
                  labelId="instrument-type-label"
                  id="instrument-type-select"
                  value={instrumentType}
                  label={t('instrumentType')}
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
                onClick={openDetect}
                sx={{ whiteSpace: 'nowrap', height: 56, px: 2 }}
              >
                {t('detect')}
              </Button>
            </Box>

            <Box>
              <Typography id="tuning-slider" gutterBottom>
                {t('tuningRatio', { tuning: tuning.toFixed(2) })}
              </Typography>
              <Slider
                aria-label="Tuning"
                value={tuning}
                onChange={(_, newValue) => setTuning(newValue as number)}
                valueLabelDisplay="auto"
                step={0.01}
                min={0.8}
                max={1.2}
              />
            </Box>

            <Box>
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
          </Box>
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
