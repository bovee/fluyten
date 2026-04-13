import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ArrowBack from '@mui/icons-material/ArrowBack';
import DragIndicator from '@mui/icons-material/DragIndicator';
import EditOutlined from '@mui/icons-material/EditOutlined';
import FileDownload from '@mui/icons-material/FileDownload';
import RemoveCircle from '@mui/icons-material/RemoveCircle';
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
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import { PageBackground } from './PageBackground';
import { PageHeader } from './PageHeader';
import { type UserSet, useStore } from './store';
import { type Song } from './music';

interface SetPageProps {
  set: UserSet;
  onBack: () => void;
  onSelectSong: (song: Song, readOnly: boolean) => void;
}

export function SetPage({ set, onBack, onSelectSong }: SetPageProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const songs = useStore((state) => state.songs);
  const reorderSet = useStore((state) => state.reorderSet);
  const renameSet = useStore((state) => state.renameSet);
  const deleteSet = useStore((state) => state.deleteSet);
  const [editOpen, setEditOpen] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Resolve songs in set order, filtering out any deleted songs
  const setSongs = set.songIds
    .map((id) => songs.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined);

  const handleExport = () => {
    const content = setSongs
      .map((s, i) => s.abc.replace(/^X:\s*\d+/m, `X:${i + 1}`))
      .join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${set.title}.abc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Drag state
  const dragIndex = useRef<number | null>(null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    dragIndex.current = index;
    setDragSourceIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex.current !== null && dragIndex.current !== index) {
      setDragOverIndex(index);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      const from = dragIndex.current;
      if (from === null || from === dropIndex) {
        dragIndex.current = null;
        setDragOverIndex(null);
        return;
      }
      const newIds = [...set.songIds];
      const [moved] = newIds.splice(from, 1);
      newIds.splice(dropIndex, 0, moved);
      reorderSet(set.id, newIds);
      dragIndex.current = null;
      setDragSourceIndex(null);
      setDragOverIndex(null);
    },
    [set.id, set.songIds, reorderSet]
  );

  const handleDragEnd = useCallback(() => {
    dragIndex.current = null;
    setDragSourceIndex(null);
    setDragOverIndex(null);
  }, []);

  // Keyboard reordering: arrow keys on the drag handle
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const newIds = [...set.songIds];
      const swapWith = e.key === 'ArrowUp' ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= newIds.length) return;
      [newIds[index], newIds[swapWith]] = [newIds[swapWith], newIds[index]];
      reorderSet(set.id, newIds);
    },
    [set.id, set.songIds, reorderSet]
  );

  return (
    <>
      <PageBackground />

      <PageHeader
        rightAction={
          <Tooltip title={t('exportSongs')}>
            <IconButton onClick={handleExport} aria-label={t('exportSongs')}>
              <FileDownload />
            </IconButton>
          </Tooltip>
        }
        subtitle={
          <>
            {set.title}
            <Tooltip title={t('editSet')}>
              <IconButton
                size="small"
                aria-label={t('editSet')}
                onClick={() => {
                  setEditValue(set.title);
                  setEditOpen(true);
                }}
                sx={{ color: 'text.disabled' }}
              >
                <EditOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        }
        leftAction={
          <Tooltip title={t('back')}>
            <IconButton onClick={onBack} aria-label={t('back')}>
              <ArrowBack />
            </IconButton>
          </Tooltip>
        }
      />

      {/* Song list */}
      <div
        role="list"
        style={{
          width: 'min(600px, 95vw)',
          margin: '16px auto 0',
        }}
      >
        {setSongs.map((song, index) => (
          <ListItem
            key={song.id}
            role="listitem"
            disablePadding
            sx={{
              borderTop:
                dragOverIndex === index
                  ? `2px solid ${theme.palette.primary.main}`
                  : '2px solid transparent',
              opacity: dragSourceIndex === index ? 0.4 : 1,
            }}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
          >
            <ListItemButton
              onClick={() => onSelectSong(song, false)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              aria-label={`${song.title} — ${t('reorderSong')}`}
              sx={{ minWidth: 0, pl: '6px', cursor: 'grab' }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mr: 1,
                  p: 0.5,
                  borderRadius: 1,
                  color: 'text.disabled',
                  flexShrink: 0,
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    color: 'text.secondary',
                  },
                }}
              >
                <DragIndicator fontSize="small" />
              </Box>
              <ListItemText primary={song.title} secondary={song.composer} />
            </ListItemButton>
            <Tooltip title={t('removeFromSet')}>
              <IconButton
                size="small"
                aria-label={t('removeFromSet')}
                onClick={() =>
                  reorderSet(
                    set.id,
                    set.songIds.filter((id) => id !== song.id)
                  )
                }
                sx={{ mr: 0.5, flexShrink: 0, color: 'text.disabled' }}
              >
                <RemoveCircle fontSize="small" />
              </IconButton>
            </Tooltip>
          </ListItem>
        ))}
      </div>
      {setSongs.length === 0 && (
        <Typography
          sx={{ color: 'text.secondary', textAlign: 'center', mt: 4 }}
        >
          {t('emptySet')}
        </Typography>
      )}

      <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
        <DialogTitle>{t('editSet')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label={t('setName')}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && editValue.trim()) {
                e.preventDefault();
                renameSet(set.id, editValue.trim());
                setEditOpen(false);
              }
            }}
            sx={{ mt: 1 }}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button
            color="error"
            onClick={() => {
              setEditOpen(false);
              setDeleteConfirmOpen(true);
            }}
          >
            {t('deleteSet')}
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setEditOpen(false)}>{t('cancel')}</Button>
          <Button
            variant="contained"
            disabled={!editValue.trim()}
            onClick={() => {
              renameSet(set.id, editValue.trim());
              setEditOpen(false);
            }}
          >
            {t('save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>{t('deleteSet')}</DialogTitle>
        <DialogContent>{t('confirmDeleteSet')}</DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>
            {t('cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              deleteSet(set.id);
              onBack();
            }}
          >
            {t('deleteSet')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
