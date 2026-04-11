import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import ArrowDropDown from '@mui/icons-material/ArrowDropDown';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import CheckCircle from '@mui/icons-material/CheckCircle';
import EditNote from '@mui/icons-material/EditNote';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked';
import QueueMusic from '@mui/icons-material/QueueMusic';
import Sort from '@mui/icons-material/Sort';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
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
import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';

import { PageBackground } from './PageBackground';
import { PageHeader } from './PageHeader';
import {
  parseSongsFromFile,
  parseSongsFromUrl,
  HttpError,
} from './io/fileImport';
import { getStarterBookUrl, isStarterBookUrl } from './instrument';
import { type Song } from './music';
import { useStore, type SortKey, type UserSet } from './store';

interface IndexPageProps {
  onSelectSong: (song: Song, readOnly: boolean) => void;
  onSelectSet: (set: UserSet) => void;
}

export function IndexPage({ onSelectSong, onSelectSet }: IndexPageProps) {
  const { t } = useTranslation();
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
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [infoSong, setInfoSong] = useState<(typeof songs)[0] | null>(null);
  const [infoSongDeleteConfirm, setInfoSongDeleteConfirm] = useState(false);
  const [createSetDialogOpen, setCreateSetDialogOpen] = useState(false);
  const [newSetTitle, setNewSetTitle] = useState('');
  const [addToSetOpen, setAddToSetOpen] = useState(false);
  const longPressTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const suppressNextClick = useRef<Set<string>>(new Set());
  const importFileRef = useRef<HTMLInputElement>(null);

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  const songs = useStore((state) => state.songs);
  const method = useStore((state) => state.method);
  if (method === 'none' && sortKey === 'difficulty') setSortKey('order');
  const addSongs = useStore((state) => state.addSongs);
  const removeSong = useStore((state) => state.removeSong);
  const sets = useStore((state) => state.sets);
  const createSet = useStore((state) => state.createSet);
  const addSongsToSet = useStore((state) => state.addSongsToSet);

  const filteredSets = filterText
    ? sets.filter((s) =>
        s.title.toLowerCase().includes(filterText.toLowerCase())
      )
    : [...sets];

  const filteredSongs = (() => {
    const lowerFilter = filterText.toLowerCase();
    const base = filterText
      ? songs.filter(
          (s) =>
            s.title.toLowerCase().includes(lowerFilter) ||
            (s.composer ?? '').toLowerCase().includes(lowerFilter)
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
      setIsSelectMode(true);
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
      if (next.size === 0) setIsSelectMode(false);
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
    exitSelectMode();
    setDeleteConfirmOpen(false);
  };

  return (
    <>
      {/* Preload Bravura music font so it's ready when navigating to SongPage */}
      <span
        style={{
          fontFamily: 'Bravura',
          position: 'absolute',
          visibility: 'hidden',
        }}
      />
      <PageBackground />

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

      <PageHeader
        rightAction={
          <Tooltip title={t('editSongs')}>
            <IconButton
              onClick={(e) => setEditMenuAnchor(e.currentTarget)}
              aria-label={t('editSongs')}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <EditNote />
                <ArrowDropDown fontSize="small" sx={{ ml: '-4px' }} />
              </Box>
            </IconButton>
          </Tooltip>
        }
      />

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
        {filteredSets.map((songSet) => (
          <ListItem key={songSet.id} role="listitem" disablePadding>
            <ListItemButton
              onClick={() => onSelectSet(songSet)}
              sx={{ minWidth: 0, pl: '10px' }}
            >
              <QueueMusic
                fontSize="small"
                sx={{
                  mr: '21px',
                  flexShrink: 0,
                  alignSelf: 'center',
                  color: 'text.secondary',
                }}
              />
              <ListItemText
                primary={songSet.title}
                secondary={t('setOf', { count: songSet.songIds.length })}
                sx={{
                  '& .MuiListItemText-primary': {
                    position: 'relative',
                    top: '2px',
                  },
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
        {filteredSongs.map((song) => {
          const selected = selectedIds.has(song.id);
          return (
            <ListItem
              key={song.id}
              role="listitem"
              disablePadding
              sx={{
                display: 'flex',
                alignItems: 'stretch',
                ...(isSelectMode && selected
                  ? { backgroundColor: 'action.selected' }
                  : {}),
              }}
            >
              {isSelectMode ? (
                <Tooltip title={selected ? t('deselectSong') : t('selectSong')}>
                  <IconButton
                    size="small"
                    aria-label={selected ? t('deselectSong') : t('selectSong')}
                    onClick={() => handleCircleClick(song.id)}
                    sx={{
                      ml: '6px',
                      mr: '2px',
                      color: selected ? 'primary.main' : 'text.disabled',
                      flexShrink: 0,
                      alignSelf: 'center',
                    }}
                  >
                    {selected ? (
                      <CheckCircle fontSize="small" />
                    ) : (
                      <RadioButtonUnchecked fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              ) : (
                <Tooltip title={t('songInfo')}>
                  <IconButton
                    size="small"
                    aria-label={t('songInfo')}
                    onClick={() => setInfoSong(song)}
                    sx={{
                      ml: '6px',
                      mr: '2px',
                      color: 'text.disabled',
                      flexShrink: 0,
                      alignSelf: 'center',
                    }}
                  >
                    <InfoOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <ListItemButton
                onClick={() => handleRowClick(song)}
                onPointerDown={() => handleLongPressStart(song.id)}
                onPointerUp={() => handleLongPressCancel(song.id)}
                onPointerLeave={() => handleLongPressCancel(song.id)}
                onPointerCancel={() => handleLongPressCancel(song.id)}
                sx={{ flex: 1, minWidth: 0, pl: '2px' }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                  }}
                >
                  <ListItemText
                    primary={song.title}
                    secondary={song.composer}
                    sx={{
                      flex: '1 1 0',
                      minWidth: 0,
                      overflow: 'hidden',
                      '& .MuiListItemText-primary': {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      },
                      '& .MuiListItemText-secondary': {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      },
                    }}
                  />
                </Box>
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

      <Menu
        anchorEl={editMenuAnchor}
        open={Boolean(editMenuAnchor)}
        onClose={() => setEditMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setEditMenuAnchor(null);
            handleAddEmptySong();
          }}
        >
          {t('addEmptySong')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setEditMenuAnchor(null);
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
            setEditMenuAnchor(null);
          }}
        >
          {t('importAbcUrl')}
        </MenuItem>
        <Divider />
        {isSelectMode ? (
          [
            <MenuItem
              key="unselect"
              onClick={() => {
                exitSelectMode();
                setEditMenuAnchor(null);
              }}
            >
              {t('unselectSongs')}
            </MenuItem>,
            <MenuItem
              key="createSet"
              disabled={selectedIds.size === 0}
              onClick={() => {
                setEditMenuAnchor(null);
                setNewSetTitle(t('newSet'));
                setCreateSetDialogOpen(true);
              }}
            >
              {t('createSet')}
            </MenuItem>,
            <MenuItem
              key="addToSet"
              disabled={selectedIds.size === 0 || sets.length === 0}
              onClick={() => {
                setEditMenuAnchor(null);
                setAddToSetOpen(true);
              }}
            >
              {t('addToSet')}
            </MenuItem>,
            <MenuItem
              key="delete"
              disabled={selectedIds.size === 0}
              onClick={() => {
                setEditMenuAnchor(null);
                setDeleteConfirmOpen(true);
              }}
              sx={{ color: selectedIds.size > 0 ? 'error.main' : undefined }}
            >
              {t('deleteSongs')}
            </MenuItem>,
          ]
        ) : (
          <MenuItem
            onClick={() => {
              setIsSelectMode(true);
              setEditMenuAnchor(null);
            }}
          >
            {t('selectSongs')}
          </MenuItem>
        )}
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

      {/* Song info dialog */}
      <Dialog open={infoSong !== null} onClose={() => setInfoSong(null)}>
        <DialogTitle>{t('songInfo')}</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', border: 0 }}>
                  {t('songTitle')}
                </TableCell>
                <TableCell sx={{ border: 0 }}>{infoSong?.title}</TableCell>
              </TableRow>
              {(() => {
                return infoSong?.composer ? (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', border: 0 }}>
                      {t('composer')}
                    </TableCell>
                    <TableCell sx={{ border: 0 }}>
                      {infoSong.composer}
                    </TableCell>
                  </TableRow>
                ) : null;
              })()}
              {infoSong?.beats != null && (
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', border: 0 }}>
                    {t('sortLength')}
                  </TableCell>
                  <TableCell sx={{ border: 0 }}>{infoSong.beats}</TableCell>
                </TableRow>
              )}
              {method !== 'none' && infoSong?.difficulty && (
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', border: 0 }}>
                    {t('sortDifficulty')}
                  </TableCell>
                  <TableCell sx={{ border: 0 }}>
                    {infoSong.difficulty}
                  </TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', border: 0 }}>
                  {t('sortPracticeCount')}
                </TableCell>
                <TableCell sx={{ border: 0 }}>
                  {infoSong?.practiceCount ?? 0}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', border: 0 }}>
                  {t('sortAverageScore')}
                </TableCell>
                <TableCell sx={{ border: 0 }}>
                  {infoSong?.practiceHistory?.length
                    ? `${Math.round(infoSong.practiceHistory.reduce((a, b) => a + b, 0) / infoSong.practiceHistory.length)}%`
                    : '—'}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button color="error" onClick={() => setInfoSongDeleteConfirm(true)}>
            {t('deleteSong')}
          </Button>
          <Button
            onClick={() => {
              if (!infoSong) return;
              const blob = new Blob([infoSong.abc], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${infoSong.title}.abc`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            {t('exportSong')}
          </Button>
          <Button onClick={() => setInfoSong(null)}>{t('close')}</Button>
        </DialogActions>
      </Dialog>

      {/* Single-song delete confirmation */}
      <Dialog
        open={infoSongDeleteConfirm}
        onClose={() => setInfoSongDeleteConfirm(false)}
      >
        <DialogTitle>{t('deleteSong')}</DialogTitle>
        <DialogContent>{t('confirmDeleteSongs', { count: 1 })}</DialogContent>
        <DialogActions>
          <Button onClick={() => setInfoSongDeleteConfirm(false)}>
            {t('cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (infoSong) removeSong(infoSong.id);
              setInfoSongDeleteConfirm(false);
              setInfoSong(null);
            }}
          >
            {t('deleteSong')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add to Set dialog */}
      <Dialog open={addToSetOpen} onClose={() => setAddToSetOpen(false)}>
        <DialogTitle>{t('addToSet')}</DialogTitle>
        <DialogContent sx={{ pt: '8px !important', minWidth: 280 }}>
          {sets.map((s) => (
            <MenuItem
              key={s.id}
              onClick={() => {
                addSongsToSet(s.id, [...selectedIds]);
                exitSelectMode();
                setAddToSetOpen(false);
              }}
            >
              {s.title}
            </MenuItem>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddToSetOpen(false)}>{t('cancel')}</Button>
        </DialogActions>
      </Dialog>

      {/* Create a Set dialog */}
      <Dialog
        open={createSetDialogOpen}
        onClose={() => setCreateSetDialogOpen(false)}
      >
        <DialogTitle>{t('createSet')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label={t('setName')}
            value={newSetTitle}
            onChange={(e) => setNewSetTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newSetTitle.trim()) {
                e.preventDefault();
                createSet(newSetTitle.trim(), [...selectedIds]);
                exitSelectMode();
                setCreateSetDialogOpen(false);
              }
            }}
            sx={{ mt: 1 }}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateSetDialogOpen(false)}>
            {t('cancel')}
          </Button>
          <Button
            variant="contained"
            disabled={!newSetTitle.trim()}
            onClick={() => {
              createSet(newSetTitle.trim(), [...selectedIds]);
              exitSelectMode();
              setCreateSetDialogOpen(false);
            }}
          >
            {t('create')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
