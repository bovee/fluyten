import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Add from '@mui/icons-material/Add';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import CheckCircle from '@mui/icons-material/CheckCircle';
import EditNote from '@mui/icons-material/EditNote';
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked';
import Settings from '@mui/icons-material/Settings';
import Sort from '@mui/icons-material/Sort';
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

import { useTheme } from '@mui/material/styles';
import {
  parseSongsFromFile,
  parseSongsFromUrl,
  HttpError,
} from './io/fileImport';
import { getStarterBookUrl, isStarterBookUrl } from './instrument';
import { SettingsDialog } from './SettingsDialog';
import { type Song } from './music';
import { useStore, type SortKey } from './store';

interface IndexPageProps {
  onSelectSong: (song: Song, readOnly: boolean) => void;
}

export function IndexPage({ onSelectSong }: IndexPageProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addSongMenuAnchor, setAddSongMenuAnchor] =
    useState<HTMLElement | null>(null);
  const [editMenuAnchor, setEditMenuAnchor] = useState<HTMLElement | null>(
    null
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [importUrl, setImportUrl] = useState<{
    value: string;
    error: string | null;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<HTMLElement | null>(
    null
  );
  const filterText = useStore((state) => state.filterText);
  const setFilterText = useStore((state) => state.setFilterText);
  const sortKey = useStore((state) => state.sortKey);
  const setSortKey = useStore((state) => state.setSortKey);
  const sortDir = useStore((state) => state.sortDir);
  const setSortDir = useStore((state) => state.setSortDir);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const longPressTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const suppressNextClick = useRef<Set<string>>(new Set());
  const importFileRef = useRef<HTMLInputElement>(null);

  const isSelecting = selectedIds.size > 0;

  const songs = useStore((state) => state.songs);
  const method = useStore((state) => state.method);
  if (method === 'none' && sortKey === 'difficulty') setSortKey('order');

  const filteredSongs = (() => {
    const base = filterText
      ? songs.filter((s) =>
          s.title.toLowerCase().includes(filterText.toLowerCase())
        )
      : [...songs];
    if (sortKey === 'title') {
      base.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortKey === 'length') {
      base.sort((a, b) => (a.beats ?? 0) - (b.beats ?? 0));
    } else if (sortKey === 'difficulty') {
      base.sort((a, b) =>
        (a.difficulty ?? '').localeCompare(b.difficulty ?? '')
      );
    } else if (sortKey === 'practiceCount') {
      base.sort((a, b) => (a.practiceCount ?? 0) - (b.practiceCount ?? 0));
    } else if (sortKey === 'averageScore') {
      const avg = (s: (typeof base)[0]) => {
        const h = s.practiceHistory ?? [];
        return h.length === 0 ? 0 : h.reduce((a, b) => a + b, 0) / h.length;
      };
      base.sort((a, b) => avg(a) - avg(b));
    } else {
      // 'order': store order is oldest-first; desc = most recent first
      if (sortDir === 'desc') base.reverse();
    }
    if (sortKey !== 'order' && sortDir === 'desc') base.reverse();
    return base;
  })();
  const addSongs = useStore((state) => state.addSongs);
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
        addSongs(parsed);
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
  }, [addSongs]);

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
    const newSongTitle = t('newSong');
    addSongs([
      {
        id: crypto.randomUUID(),
        title: newSongTitle,
        abc: `X:1\nT:${newSongTitle}\nM:4/4\nL:1/4\nK:C\n`,
      },
    ]);
    setAddSongMenuAnchor(null);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const parsed = await parseSongsFromFile(file);
      addSongs(parsed);
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
      const toAdd = isStarter
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
        : parsed;
      addSongs(toAdd);
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
    setEditMenuAnchor(null);
  };

  const handleSortSelect = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'order' ? 'desc' : 'asc');
    }
    setSortMenuAnchor(null);
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
          backgroundColor: theme.palette.background.default,
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
          color: theme.palette.text.primary,
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
        <span style={{ position: 'fixed', top: 8, right: 48 }}>
          <IconButton
            onClick={(e) => setEditMenuAnchor(e.currentTarget)}
            aria-label={t('editSongs')}
            disabled={!isSelecting}
          >
            <EditNote />
          </IconButton>
        </span>
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
      <h1 style={{ color: theme.palette.text.primary }}>{t('appTitle')}</h1>

      {songs.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            mb: 1,
            justifyContent: 'center',
          }}
        >
          <TextField
            size="small"
            placeholder={t('filterSongs')}
            inputProps={{ 'aria-label': t('filterSongs') }}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            sx={{ width: 'min(360px, calc(95vw - 44px))' }}
          />
          <Tooltip title={t('sortSongs')}>
            <IconButton
              onClick={(e) => setSortMenuAnchor(e.currentTarget)}
              aria-label={t('sortSongs')}
              color={
                sortKey !== 'order' || sortDir !== 'desc'
                  ? 'primary'
                  : 'default'
              }
            >
              <Sort />
            </IconButton>
          </Tooltip>
        </Box>
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
        <ListItem role="listitem" disablePadding>
          <ListItemButton
            onClick={(e) => setAddSongMenuAnchor(e.currentTarget)}
            aria-label={t('addSong')}
            sx={{ minWidth: 0, color: 'text.secondary', pl: '10px' }}
          >
            <Add
              fontSize="small"
              sx={{ mr: '21px', flexShrink: 0, alignSelf: 'center' }}
            />
            <ListItemText
              primary={t('addSong')}
              sx={{
                '& .MuiListItemText-primary': {
                  position: 'relative',
                  top: '2px',
                },
              }}
            />
          </ListItemButton>
        </ListItem>
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
                {sortKey === 'length' && song.beats != null && (
                  <Box
                    component="span"
                    sx={{
                      ml: 1,
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 1,
                      backgroundColor: 'action.selected',
                      color: 'text.secondary',
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {song.beats}
                  </Box>
                )}
                {sortKey === 'difficulty' && song.difficulty && (
                  <Box
                    component="span"
                    sx={{
                      ml: 1,
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 1,
                      backgroundColor: 'action.selected',
                      color: 'text.secondary',
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {song.difficulty}
                  </Box>
                )}
                {sortKey === 'practiceCount' && (
                  <Box
                    component="span"
                    sx={{
                      ml: 1,
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 1,
                      backgroundColor: 'action.selected',
                      color: 'text.secondary',
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {song.practiceCount ?? 0}
                  </Box>
                )}
                {sortKey === 'averageScore' && (
                  <Box
                    component="span"
                    sx={{
                      ml: 1,
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 1,
                      backgroundColor: 'action.selected',
                      color: 'text.secondary',
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {song.practiceHistory?.length
                      ? `${Math.round(song.practiceHistory.reduce((a, b) => a + b, 0) / song.practiceHistory.length)}%`
                      : '—'}
                  </Box>
                )}
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
      </Menu>

      <Menu
        anchorEl={sortMenuAnchor}
        open={Boolean(sortMenuAnchor)}
        onClose={() => setSortMenuAnchor(null)}
      >
        {(
          [
            'order',
            'title',
            'length',
            ...(method !== 'none' ? ['difficulty' as const] : []),
            'practiceCount',
            'averageScore',
          ] as const
        ).map((key) => (
          <MenuItem
            key={key}
            onClick={() => handleSortSelect(key)}
            selected={sortKey === key}
          >
            {t(
              `sort${key.charAt(0).toUpperCase() + key.slice(1)}` as
                | 'sortOrder'
                | 'sortTitle'
                | 'sortLength'
                | 'sortDifficulty'
                | 'sortPracticeCount'
                | 'sortAverageScore'
            )}
            {sortKey === key &&
              (sortDir === 'asc' ? (
                <ArrowDownward fontSize="small" sx={{ ml: 1 }} />
              ) : (
                <ArrowUpward fontSize="small" sx={{ ml: 1 }} />
              ))}
          </MenuItem>
        ))}
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

      <Menu
        anchorEl={editMenuAnchor}
        open={Boolean(editMenuAnchor)}
        onClose={() => setEditMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setEditMenuAnchor(null);
            setDeleteConfirmOpen(true);
          }}
          sx={{ color: 'error.main' }}
        >
          {t('deleteSongs')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setEditMenuAnchor(null);
            handleExportSongs();
          }}
        >
          {t('exportSongs')}
        </MenuItem>
      </Menu>

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
