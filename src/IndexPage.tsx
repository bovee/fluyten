import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Add from '@mui/icons-material/Add';
import CheckCircle from '@mui/icons-material/CheckCircle';
import EditNote from '@mui/icons-material/EditNote';
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked';
import Settings from '@mui/icons-material/Settings';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';

import {
  parseSongsFromFile,
  parseSongsFromUrl,
  HttpError,
} from './io/fileImport';
import { getStarterBookUrl, isStarterBookUrl } from './instrument';
import { ScaleDialog } from './scales/ScaleDialog';
import { SettingsDialog } from './SettingsDialog';
import { type Song } from './music';
import { useStore } from './store';

interface IndexPageProps {
  onSelectSong: (song: Song, readOnly: boolean) => void;
}

export function IndexPage({ onSelectSong }: IndexPageProps) {
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scaleDialogOpen, setScaleDialogOpen] = useState(false);
  const [addSongMenuAnchor, setAddSongMenuAnchor] =
    useState<HTMLElement | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [importUrl, setImportUrl] = useState<{
    value: string;
    error: string | null;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const longPressTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const suppressNextClick = useRef<Set<string>>(new Set());
  const importFileRef = useRef<HTMLInputElement>(null);

  const isSelecting = selectedIds.size > 0;

  const songs = useStore((state) => state.songs);
  const filteredSongs = filterText
    ? songs.filter((s) =>
        s.title.toLowerCase().includes(filterText.toLowerCase())
      )
    : songs;
  const addSong = useStore((state) => state.addSong);
  const removeSong = useStore((state) => state.removeSong);

  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) setIsDragOver(false);
    };
    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer?.files[0];
      if (!file || !/\.(abc|txt|musicxml|xml|mxl)$/i.test(file.name)) return;
      try {
        const parsed = await parseSongsFromFile(file);
        parsed.forEach((s) => addSong(s));
      } catch (err) {
        alert(`Failed to import file: ${(err as Error).message}`);
      }
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [addSong]);

  const handleLongPressStart = useCallback((songId: string) => {
    const timer = setTimeout(() => {
      longPressTimers.current.delete(songId);
      suppressNextClick.current.add(songId);
      setSelectedIds((prev) => new Set([...prev, songId]));
    }, 500);
    longPressTimers.current.set(songId, timer);
  }, []);

  const handleLongPressCancel = useCallback((songId: string) => {
    const timer = longPressTimers.current.get(songId);
    if (timer !== undefined) {
      clearTimeout(timer);
      longPressTimers.current.delete(songId);
    }
  }, []);

  const handleRowClick = useCallback(
    (song: Song) => {
      if (suppressNextClick.current.has(song.id)) {
        suppressNextClick.current.delete(song.id);
        return;
      }
      onSelectSong(song, false);
    },
    [onSelectSong]
  );

  const handleCircleClick = useCallback((songId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  }, []);

  const handleAddEmptySong = () => {
    addSong({
      id: crypto.randomUUID(),
      title: 'New Song',
      abc: `X:1\nT:New Song\nM:C\nL:1/4\nK:C\nC D E F |`,
    });
    setAddSongMenuAnchor(null);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const parsed = await parseSongsFromFile(file);
      parsed.forEach((s) => addSong(s));
    } catch (err) {
      alert(`Failed to import file: ${(err as Error).message}`);
    }
  };

  const handleImportUrl = async () => {
    const current = importUrl;
    if (!current) return;
    setImportUrl({ ...current, error: null });
    try {
      new URL(current.value);
    } catch {
      setImportUrl({ ...current, error: t('importUrlInvalidError') });
      return;
    }
    try {
      const parsed = await parseSongsFromUrl(current.value);
      const isStarter = isStarterBookUrl(current.value);
      (isStarter
        ? parsed.map((s, i) => {
            const translatedTitle = t(`beginnerSongs.${i}`, {
              defaultValue: s.title,
            });
            return {
              ...s,
              title: translatedTitle,
              abc: s.abc.replace(/^T:.*$/m, `T:${translatedTitle}`),
            };
          })
        : parsed
      ).forEach((s) => addSong(s));
      setImportUrl(null);
    } catch (err) {
      if (err instanceof HttpError) {
        setImportUrl({
          ...current,
          error: t('importUrlHttpError', { status: (err as HttpError).status }),
        });
      } else {
        setImportUrl({ ...current, error: t('importUrlCorsError') });
      }
    }
  };

  const handleExportSongs = () => {
    const selected = songs.filter((s) => selectedIds.has(s.id));
    const content = selected
      .map((s, i) => s.abc.replace(/^X:\s*\d+/m, `X:${i + 1}`))
      .join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'songs.abc';
    a.click();
    URL.revokeObjectURL(url);
    setEditDialogOpen(false);
  };

  const handleDeleteSongs = () => {
    selectedIds.forEach((id) => removeSong(id));
    setSelectedIds(new Set());
    setDeleteConfirmOpen(false);
  };

  return (
    <>
      {/* Page background */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#fffef9',
          zIndex: -2,
        }}
      />
      {/* Decorative treble clef watermark */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          right: '4vw',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '80vh',
          lineHeight: 1,
          color: '#1a1a1a',
          opacity: 0.05,
          zIndex: -1,
          pointerEvents: 'none',
          userSelect: 'none',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        𝄞
      </div>

      {/* Drag-over overlay */}
      {isDragOver && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            border: '4px dashed #1976d2',
            backgroundColor: 'rgba(25, 118, 210, 0.08)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        />
      )}

      <Tooltip title={t('editSongs')}>
        <span style={{ position: 'fixed', top: 8, right: 88 }}>
          <IconButton
            onClick={() => setEditDialogOpen(true)}
            aria-label={t('editSongs')}
            disabled={!isSelecting}
          >
            <EditNote />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={t('addSong')}>
        <IconButton
          onClick={(e) => setAddSongMenuAnchor(e.currentTarget)}
          aria-label={t('addSong')}
          style={{ position: 'fixed', top: 8, right: 48 }}
        >
          <Add />
        </IconButton>
      </Tooltip>
      <Tooltip title={t('settingsButton')}>
        <IconButton
          onClick={() => setSettingsOpen(true)}
          aria-label={t('settingsButton')}
          style={{ position: 'fixed', top: 8, right: 8 }}
        >
          <Settings />
        </IconButton>
      </Tooltip>
      <h1 style={{ color: '#1c3248' }}>{t('appTitle')}</h1>

      {songs.length > 0 && (
        <TextField
          size="small"
          placeholder={t('filterSongs')}
          inputProps={{ 'aria-label': t('filterSongs') }}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          sx={{ width: 'min(400px, 95vw)', mb: 1 }}
        />
      )}

      <div
        role="list"
        style={{
          width: 'min(1200px, 95vw)',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fill, minmax(min(280px, 100%), 1fr))',
        }}
      >
        {filteredSongs.map((song) => {
          const selected = selectedIds.has(song.id);
          return (
            <ListItem
              key={song.id}
              role="listitem"
              disablePadding
              sx={selected ? { backgroundColor: 'action.selected' } : undefined}
            >
              <Tooltip title={selected ? t('deselectSong') : t('selectSong')}>
                <IconButton
                  size="small"
                  aria-label={selected ? t('deselectSong') : t('selectSong')}
                  onClick={() => handleCircleClick(song.id)}
                  sx={{
                    ml: 0.5,
                    color: selected ? 'primary.main' : 'text.disabled',
                    flexShrink: 0,
                  }}
                >
                  {selected ? (
                    <CheckCircle fontSize="small" />
                  ) : (
                    <RadioButtonUnchecked fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
              <ListItemButton
                onClick={() => handleRowClick(song)}
                onPointerDown={() => handleLongPressStart(song.id)}
                onPointerUp={() => handleLongPressCancel(song.id)}
                onPointerLeave={() => handleLongPressCancel(song.id)}
                onPointerCancel={() => handleLongPressCancel(song.id)}
                sx={{ minWidth: 0 }}
              >
                <ListItemText primary={song.title} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </div>

      <Menu
        anchorEl={addSongMenuAnchor}
        open={Boolean(addSongMenuAnchor)}
        onClose={() => setAddSongMenuAnchor(null)}
      >
        <MenuItem onClick={handleAddEmptySong}>{t('addEmptySong')}</MenuItem>
        <MenuItem
          onClick={() => {
            setAddSongMenuAnchor(null);
            importFileRef.current?.click();
          }}
        >
          {t('importFromFile')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setImportUrl({
              value: getStarterBookUrl(useStore.getState().instrumentType),
              error: null,
            });
            setAddSongMenuAnchor(null);
          }}
        >
          {t('importAbcUrl')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAddSongMenuAnchor(null);
            setScaleDialogOpen(true);
          }}
        >
          {t('generateScale')}
        </MenuItem>
      </Menu>

      <input
        ref={importFileRef}
        type="file"
        accept=".abc,.txt,.musicxml,.xml,.mxl,.mid,.midi"
        style={{ display: 'none' }}
        onChange={(e) => void handleImportFile(e)}
      />

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <ScaleDialog
        open={scaleDialogOpen}
        onClose={() => setScaleDialogOpen(false)}
        onCreate={(song) => {
          addSong(song);
          setScaleDialogOpen(false);
        }}
      />

      {/* Edit Songs dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>{t('editSongs')}</DialogTitle>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Button
            color="error"
            onClick={() => {
              setEditDialogOpen(false);
              setDeleteConfirmOpen(true);
            }}
          >
            {t('deleteSongs')}
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={handleExportSongs}>
              {t('exportSongs')}
            </Button>
            <Button onClick={() => setEditDialogOpen(false)}>
              {t('cancel')}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>{t('deleteSongs')}</DialogTitle>
        <DialogContent>
          {t('confirmDeleteSongs', { count: selectedIds.size })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>
            {t('cancel')}
          </Button>
          <Button color="error" variant="contained" onClick={handleDeleteSongs}>
            {t('deleteSongs')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import from URL */}
      <Dialog open={importUrl !== null} onClose={() => setImportUrl(null)}>
        <DialogTitle>{t('importAbcUrl')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="URL"
            value={importUrl?.value ?? ''}
            onChange={(e) =>
              setImportUrl((prev) => prev && { ...prev, value: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleImportUrl();
              }
            }}
            error={importUrl?.error != null}
            helperText={importUrl?.error}
            sx={{ mt: 1 }}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportUrl(null)}>{t('cancel')}</Button>
          <Button onClick={() => void handleImportUrl()} variant="contained">
            {t('import')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
