import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Accordion from '@mui/material/Accordion';
import Box from '@mui/material/Box';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import ButtonGroup from '@mui/material/ButtonGroup';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import ArrowDropDown from '@mui/icons-material/ArrowDropDown';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Delete from '@mui/icons-material/Delete';
import Edit from '@mui/icons-material/Edit';
import FileDownload from '@mui/icons-material/FileDownload';
import Settings from '@mui/icons-material/Settings';

import {
  parseSongsFromFile,
  parseSongsFromText,
  parseSongsFromBuffer,
  isMidiPath,
} from './io/fileImport';
import { getStarterBookUrl } from './instrument';
import { ScaleDialog } from './scales/ScaleDialog';
import { SettingsDialog } from './SettingsDialog';
import { type Song } from './music';
import { useStore, type UserBook, type UserSong } from './store';

interface IndexPageProps {
  onSelectSong: (song: Song, readOnly: boolean, bookId?: string) => void;
  expandedBook: string | false;
  onExpandedBookChange: (bookId: string | false) => void;
}

export function IndexPage({
  onSelectSong,
  expandedBook,
  onExpandedBookChange,
}: IndexPageProps) {
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scaleDialogBookId, setScaleDialogBookId] = useState<string | null>(
    null
  );
  const [addSongMenu, setAddSongMenu] = useState<{
    anchor: HTMLElement;
    bookId: string;
  } | null>(null);
  const [newBook, setNewBook] = useState<{ title: string } | null>(null);
  const [renameBook, setRenameBook] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deleteConfirmBookId, setDeleteConfirmBookId] = useState<string | null>(
    null
  );
  const [deleteConfirmSong, setDeleteConfirmSong] = useState<{
    bookId: string;
    songId: string;
    title: string;
  } | null>(null);
  const [exportBook, setExportBook] = useState<{
    id: string;
    fileName: string;
  } | null>(null);
  const [importUrl, setImportUrl] = useState<{
    bookId: string;
    value: string;
    error: string | null;
  } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importFileBookId, setImportFileBookId] = useState<string | null>(null);
  const [dragOverBookId, setDragOverBookId] = useState<string | null>(null);

  const userBooks = useStore((state) => state.userBooks);
  const addUserBook = useStore((state) => state.addUserBook);
  const removeUserBook = useStore((state) => state.removeUserBook);
  const renameUserBook = useStore((state) => state.renameUserBook);
  const addSongToBook = useStore((state) => state.addSongToBook);
  const removeSongFromBook = useStore((state) => state.removeSongFromBook);

  const handleAccordionChange =
    (bookId: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
      onExpandedBookChange(isExpanded ? bookId : false);
    };

  const handleCreateBook = () => {
    if (!newBook?.title.trim()) return;
    addUserBook(newBook.title.trim());
    setNewBook(null);
  };

  const handleRenameBook = () => {
    if (renameBook?.title.trim()) {
      renameUserBook(renameBook.id, renameBook.title.trim());
    }
    setRenameBook(null);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const bookId = importFileBookId;
    if (!file || !bookId) return;
    e.target.value = '';
    try {
      const songs = await parseSongsFromFile(file);
      songs.forEach((song) => addSongToBook(bookId, song));
    } catch (err) {
      alert(`Failed to import file: ${(err as Error).message}`);
    }
  };

  const handleDropOnBook = async (bookId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverBookId(null);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!/\.(abc|txt|musicxml|xml|mxl)$/i.test(file.name)) return;
    try {
      const songs = await parseSongsFromFile(file);
      songs.forEach((song) => addSongToBook(bookId, song));
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
      const response = await fetch(current.value);
      if (!response.ok) {
        setImportUrl({
          ...current,
          error: t('importUrlHttpError', { status: response.status }),
        });
        return;
      }
      const urlPath = new URL(current.value).pathname;
      const fallbackTitle = (
        urlPath.split('/').pop()?.split('?')[0] ?? 'Imported'
      ).replace(/\.[^.]+$/, '');
      let songs;
      if (isMidiPath(urlPath)) {
        const buffer = await response.arrayBuffer();
        songs = await parseSongsFromBuffer(buffer, urlPath, fallbackTitle);
      } else {
        const text = await response.text();
        songs = await parseSongsFromText(text, urlPath, fallbackTitle);
      }
      songs.forEach((song) => addSongToBook(current.bookId, song));
      setImportUrl(null);
    } catch {
      setImportUrl({ ...current, error: t('importUrlCorsError') });
    }
  };

  const handleAddSong = (bookId: string) => {
    const newSong: UserSong = {
      id: crypto.randomUUID(),
      title: 'New Song',
      abc: `X:1\nT:New Song\nM:C\nL:1/4\nK:C\nC D E F |`,
    };
    addSongToBook(bookId, newSong);
  };

  const openRenameBook = (book: UserBook, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameBook({ id: book.id, title: book.title });
  };

  const handleDeleteBook = (bookId: string) => {
    removeUserBook(bookId);
    setRenameBook(null);
    setDeleteConfirmBookId(null);
  };

  const openExport = (book: UserBook, e: React.MouseEvent) => {
    e.stopPropagation();
    setExportBook({ id: book.id, fileName: book.title });
  };

  const handleExport = () => {
    if (!exportBook) return;
    const book = userBooks.find((b) => b.id === exportBook.id);
    if (!book) return;
    const content = book.songs
      .map((song, i) => song.abc.replace(/^X:\s*\d+/m, `X:${i + 1}`))
      .join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportBook.fileName || book.title}.abc`;
    a.click();
    URL.revokeObjectURL(url);
    setExportBook(null);
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
      {/* Decorative treble clef watermark — uses Unicode 𝄞 from serif font */}
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

      <div style={{ width: 'min(600px, 95vw)', margin: '0 auto' }}>
        {userBooks.map((book) => (
          <Accordion
            key={book.id}
            expanded={expandedBook === book.id}
            onChange={handleAccordionChange(book.id)}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOverBookId(book.id);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node))
                setDragOverBookId(null);
            }}
            onDrop={(e) => void handleDropOnBook(book.id, e)}
            sx={{
              backgroundColor:
                dragOverBookId === book.id ? '#e8f4fd' : '#fffef9',
              outline:
                dragOverBookId === book.id ? '2px dashed #1976d2' : 'none',
              transition: 'background-color 0.15s, outline 0.15s',
            }}
          >
            <AccordionSummary expandIcon={<ExpandMore />}>
              <strong>{book.title}</strong>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <List disablePadding>
                {book.songs.map((song) => (
                  <ListItem
                    key={song.id}
                    disablePadding
                    secondaryAction={
                      <Tooltip title={t('deleteSong')}>
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() =>
                            setDeleteConfirmSong({
                              bookId: book.id,
                              songId: song.id,
                              title: song.title,
                            })
                          }
                          aria-label={t('deleteSong')}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    }
                  >
                    <ListItemButton
                      onClick={() =>
                        onSelectSong(
                          { id: song.id, title: song.title, abc: song.abc },
                          false,
                          book.id
                        )
                      }
                    >
                      <ListItemText primary={song.title} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  m: 1,
                }}
              >
                <ButtonGroup size="small">
                  <Button onClick={() => handleAddSong(book.id)}>
                    {t('addSong')}
                  </Button>
                  <Button
                    size="small"
                    aria-label={t('addOtherSong')}
                    onClick={(e) =>
                      setAddSongMenu({
                        anchor: e.currentTarget,
                        bookId: book.id,
                      })
                    }
                  >
                    <ArrowDropDown />
                  </Button>
                </ButtonGroup>
                <ButtonGroup size="small">
                  <Tooltip title={t('exportBook')}>
                    <Button
                      onClick={(e) => openExport(book, e)}
                      aria-label={t('exportBook')}
                    >
                      <FileDownload fontSize="small" />
                    </Button>
                  </Tooltip>
                  <Tooltip title={t('editBook')}>
                    <Button
                      onClick={(e) => openRenameBook(book, e)}
                      aria-label={t('editBook')}
                    >
                      <Edit fontSize="small" />
                    </Button>
                  </Tooltip>
                </ButtonGroup>
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}

        <Menu
          anchorEl={addSongMenu?.anchor}
          open={Boolean(addSongMenu)}
          onClose={() => setAddSongMenu(null)}
        >
          <MenuItem
            onClick={() => {
              const bookId = addSongMenu!.bookId;
              setImportFileBookId(bookId);
              setAddSongMenu(null);
              importFileRef.current?.click();
            }}
          >
            {t('importFromFile')}
          </MenuItem>
          <MenuItem
            onClick={() => {
              const bookId = addSongMenu!.bookId;
              setImportUrl({
                bookId,
                value: getStarterBookUrl(useStore.getState().instrumentType),
                error: null,
              });
              setAddSongMenu(null);
            }}
          >
            {t('importAbcUrl')}
          </MenuItem>
          <MenuItem
            onClick={() => {
              const bookId = addSongMenu!.bookId;
              setAddSongMenu(null);
              setScaleDialogBookId(bookId);
            }}
          >
            {t('generateScale')}
          </MenuItem>
        </Menu>

        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 16,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <Button variant="outlined" onClick={() => setNewBook({ title: '' })}>
            {t('addEmptyBook')}
          </Button>
          <input
            ref={importFileRef}
            type="file"
            accept=".abc,.txt,.musicxml,.xml,.mxl,.mid,.midi"
            style={{ display: 'none' }}
            onChange={(e) => void handleImportFile(e)}
          />
        </div>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <ScaleDialog
        open={scaleDialogBookId !== null}
        onClose={() => setScaleDialogBookId(null)}
        onCreate={(song) => {
          if (scaleDialogBookId) addSongToBook(scaleDialogBookId, song);
          setScaleDialogBookId(null);
        }}
      />

      <Dialog open={newBook !== null} onClose={() => setNewBook(null)}>
        <DialogTitle>{t('createNewEmptyBook')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label={t('bookName')}
            value={newBook?.title ?? ''}
            onChange={(e) =>
              setNewBook((prev) => prev && { title: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateBook();
              }
            }}
            sx={{ mt: 1 }}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewBook(null)}>{t('cancel')}</Button>
          <Button onClick={handleCreateBook} variant="contained">
            {t('create')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={renameBook !== null} onClose={() => setRenameBook(null)}>
        <DialogTitle>{t('editBook_title')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label={t('bookName')}
            value={renameBook?.title ?? ''}
            onChange={(e) =>
              setRenameBook(
                (prev) => prev && { ...prev, title: e.target.value }
              )
            }
            onKeyDown={(e) => e.key === 'Enter' && handleRenameBook()}
            sx={{ mt: 1 }}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Button
            color="error"
            onClick={() => renameBook && setDeleteConfirmBookId(renameBook.id)}
          >
            {t('deleteBook')}
          </Button>
          <div>
            <Button onClick={() => setRenameBook(null)}>{t('cancel')}</Button>
            <Button onClick={handleRenameBook} variant="contained">
              {t('save')}
            </Button>
          </div>
        </DialogActions>
      </Dialog>
      <Dialog
        open={deleteConfirmSong !== null}
        onClose={() => setDeleteConfirmSong(null)}
      >
        <DialogTitle>{t('deleteSong')}</DialogTitle>
        <DialogContent>
          {t('confirmDeleteSong', { title: deleteConfirmSong?.title ?? '' })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmSong(null)}>
            {t('cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (deleteConfirmSong) {
                removeSongFromBook(
                  deleteConfirmSong.bookId,
                  deleteConfirmSong.songId
                );
                setDeleteConfirmSong(null);
              }
            }}
          >
            {t('deleteSong')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteConfirmBookId !== null}
        onClose={() => setDeleteConfirmBookId(null)}
      >
        <DialogTitle>{t('deleteBook')}</DialogTitle>
        <DialogContent>
          {t('confirmDeleteBook', {
            title:
              userBooks.find((b) => b.id === deleteConfirmBookId)?.title ?? '',
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmBookId(null)}>
            {t('cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() =>
              deleteConfirmBookId && handleDeleteBook(deleteConfirmBookId)
            }
          >
            {t('deleteBook')}
          </Button>
        </DialogActions>
      </Dialog>

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

      <Dialog open={exportBook !== null} onClose={() => setExportBook(null)}>
        <DialogTitle>{t('exportAbc')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label={t('fileName')}
            value={exportBook?.fileName ?? ''}
            onChange={(e) =>
              setExportBook(
                (prev) => prev && { ...prev, fileName: e.target.value }
              )
            }
            onKeyDown={(e) => e.key === 'Enter' && handleExport()}
            sx={{ mt: 1 }}
            fullWidth
            slotProps={{ input: { endAdornment: '.abc' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportBook(null)}>{t('cancel')}</Button>
          <Button onClick={handleExport} variant="contained">
            {t('download')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
